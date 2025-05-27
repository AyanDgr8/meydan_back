// src/controllers/createCustomer.js

import connectDB from '../db/index.js';


export const makeNewRecord = async (req, res) => {
    let connection;
    try {
        // Check if user exists in request
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        connection = await connectDB();

        // Constants for ENUM values matching database schema exactly
        const VALID_DISPOSITIONS = ['call_back', 'schedule_visit', 'office_visit', 'urgent_required', 'interested', 'utility_call', 'emergency'];

        // Validation functions
        const validateEnum = (value, validValues, defaultValue) => {
            if (!value) return defaultValue;
            const normalizedValue = value.toString().toLowerCase().trim();
            return validValues.includes(normalizedValue) ? normalizedValue : defaultValue;
        };

        const validateVarchar = (value, maxLength) => {
            if (!value) return null;
            return value.toString().substring(0, maxLength);
        };

        const validateMobileNumber = (value) => {
            if (!value) return null;
            // Remove any non-digit characters
            const digits = value.toString().replace(/\D/g, '');
            // Check if the number has more than 12 digits
            if (digits.length > 12) {
                throw new Error('Phone number cannot exceed 12 digits');
            }
            return digits;
        };

        // Function to format date for MySQL
        const formatMySQLDateTime = (date) => {
            if (!date) return null;
            if (date instanceof Date) {
                return date.toISOString().slice(0, 19).replace('T', ' ');
            }
            if (typeof date === 'string' && date.includes('T')) {
                if (date.includes('00:00:00')) {
                    return date.slice(0, 10);
                }
                return date.slice(0, 19).replace('T', ' ');
            }
            return date;
        };

        // Extract variables from req.body
        const {
            customer_name,
            phone_no_primary, phone_no_secondary,
            email_id, address, country, 
            QUEUE_NAME,
            disposition, designation, agent_name, comment,
            scheduled_at
        } = req.body;

        const errors = [];

        // Validate phone numbers to ensure they are provided
        if (!phone_no_primary) {
            errors.push('Phone number is required.');
        }

        // Validate phone numbers
        try {
            if (!phone_no_primary) {
                errors.push('Phone number is required.');
            } else {
                validateMobileNumber(phone_no_primary);
            }
            if (phone_no_secondary) validateMobileNumber(phone_no_secondary);
        } catch (error) {
            errors.push(error.message);
        }

        // Helper to check if value is non-null and non-empty
        const isValidValue = (value) => {
            return value !== undefined && value !== null && value !== '';
        };

        // Check for duplicates in the database
        const conditions = [];
        const params = [];

        // Add conditions for each field that needs to be checked
        if (isValidValue(phone_no_primary)) {
            conditions.push('(phone_no_primary = ? AND phone_no_primary IS NOT NULL AND phone_no_primary != "")');
            params.push(phone_no_primary);
        }
        if (isValidValue(phone_no_secondary)) {
            conditions.push('(phone_no_secondary = ? AND phone_no_secondary IS NOT NULL AND phone_no_secondary != "")');
            params.push(phone_no_secondary);
        }

        if (conditions.length > 0) {
            const [existRecords] = await connection.query(`
                SELECT phone_no_primary, phone_no_secondary
                FROM customers 
                WHERE ${conditions.join(' OR ')}
            `, params);

            // Check which fields are in use and push appropriate messages
            if (existRecords.length > 0) {
                existRecords.forEach(record => {
                    if (isValidValue(phone_no_primary) && isValidValue(record.phone_no_primary) && record.phone_no_primary === phone_no_primary) {
                        errors.push('This phone number is already registered in our system');
                    }
                    if (isValidValue(phone_no_secondary) && isValidValue(record.phone_no_secondary) && record.phone_no_secondary === phone_no_secondary) {
                        errors.push('This secondary phone number is already registered in our system');
                    }
                });
            }
        }

        // If there are validation errors, return them
        if (errors.length > 0) {
            return res.status(400).json({ errors });
        }

        // Validate all fields
        const validatedData = {
            customer_name: validateVarchar(customer_name, 100),
            phone_no_primary: validateMobileNumber(phone_no_primary),
            phone_no_secondary: validateMobileNumber(phone_no_secondary),
            email_id: validateVarchar(email_id, 100),
            address: address || null,
            country: validateVarchar(country, 15),
            QUEUE_NAME: validateVarchar(QUEUE_NAME, 100),
            designation: validateVarchar(designation, 100),
            disposition: validateEnum(disposition, VALID_DISPOSITIONS, 'call_back'),
            agent_name: validateVarchar(agent_name || req.user.username, 100),
            comment: validateVarchar(comment, 255),
            scheduled_at: formatMySQLDateTime(scheduled_at) || formatMySQLDateTime(new Date())
        };

        // Get the last C_unique_id for this QUEUE_NAME
        const [lastIdResult] = await connection.query(
            'SELECT C_unique_id FROM customers WHERE QUEUE_NAME = ? ORDER BY C_unique_id DESC LIMIT 1',
            [validatedData.QUEUE_NAME]
        );

        let nextUniqueId;
        if (lastIdResult.length === 0) {
            // First record for this QUEUE_NAME
            nextUniqueId = `${validatedData.QUEUE_NAME}_1`;
        } else {
            // Extract the number from the last ID and increment it
            const lastId = lastIdResult[0].C_unique_id;
            const lastNumber = parseInt(lastId.split('_').pop());
            nextUniqueId = `${validatedData.QUEUE_NAME}_${lastNumber + 1}`;
        }

        const sql = `INSERT INTO customers (
                customer_name, phone_no_primary, phone_no_secondary,
                email_id, address, country, designation,
                disposition, agent_name, C_unique_id, comment, scheduled_at, QUEUE_NAME
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        const values = [
            validatedData.customer_name,
            validatedData.phone_no_primary,
            validatedData.phone_no_secondary,
            validatedData.email_id,
            validatedData.address,
            validatedData.country,
            validatedData.designation,
            validatedData.disposition,
            validatedData.agent_name,
            nextUniqueId,
            validatedData.comment,
            validatedData.scheduled_at,
            validatedData.QUEUE_NAME
        ];

        // Begin transaction
        await connection.beginTransaction();

        // Insert the record
        const [result] = await connection.query(sql, values);

        // Commit the transaction
        await connection.commit();

        // Return success response
        return res.status(201).json({
            success: true,
            message: 'Customer created successfully',
            customerId: result.insertId,
            C_unique_id: nextUniqueId
        });

    } catch (error) {
        console.error('Error in makeNewRecord:', error);

        // Rollback transaction if it was started
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error('Error rolling back transaction:', rollbackError);
            }
        }

        // Return error response
        return res.status(500).json({
            success: false,
            message: 'Failed to create customer',
            error: error.message
        });
    } finally {
        // Release connection if it was acquired
        if (connection) {
            try {
                connection.release();
            } catch (releaseError) {
                console.error('Error releasing connection:', releaseError);
            }
        }
    }
};

// Function to check for duplicates
const checkDuplicates = async (connection, phone_no_primary, phone_no_secondary, email_id, QUEUE_NAME) => {
    const query = `
        SELECT * FROM customers 
        WHERE QUEUE_NAME = ? AND (
            phone_no_primary = ? OR 
            phone_no_secondary = ? OR 
            (email_id = ? AND email_id IS NOT NULL)
        ) 
        ORDER BY id DESC
        LIMIT 1`;

    const [duplicates] = await connection.query(query, [
        QUEUE_NAME,
        phone_no_primary,
        phone_no_secondary,
        email_id
    ]);

    if (duplicates.length > 0) {
        return {
            exists: true,
            existing_record: duplicates[0]
        };
    }

    return { exists: false };
};

// Function to generate next C_unique_id
const generateNextUniqueId = async (connection, QUEUE_NAME, phone_no_primary, team_id) => {
    // Get all base IDs (without versions) for this queue and team
    const [existingIds] = await connection.query(
        `SELECT C_unique_id 
         FROM customers 
         WHERE team_id = ? 
         AND QUEUE_NAME = ? 
         AND C_unique_id NOT LIKE '%\\_\\_%'
         AND C_unique_id REGEXP ?
         ORDER BY CAST(SUBSTRING_INDEX(C_unique_id, '_', -1) AS UNSIGNED) DESC`,
        [team_id, QUEUE_NAME, `^${QUEUE_NAME}_[0-9]+$`]
    );

    // Find the highest number used
    let maxNumber = 0;
    for (const record of existingIds) {
        const match = record.C_unique_id.match(new RegExp(`^${QUEUE_NAME}_([0-9]+)$`));
        if (match) {
            const num = parseInt(match[1]);
            if (num > maxNumber) maxNumber = num;
        }
    }

    // Generate new base ID with next number
    const nextNumber = maxNumber + 1;
    return `${QUEUE_NAME}_${nextNumber}`;
};

// Function to get the latest record
const getLatestRecord = async (connection, phone_no_primary, QUEUE_NAME) => {
    const [records] = await connection.query(
        `SELECT * FROM customers 
         WHERE phone_no_primary = ? AND QUEUE_NAME = ?
         ORDER BY id DESC LIMIT 1`,
        [phone_no_primary, QUEUE_NAME]
    );
    return records[0];
};

export const checkExistingCustomer = async (req, res) => {
    let connection;
    try {
        connection = await connectDB();
        const phone = req.params.phone;
        const team = req.params.team;

        // Get the latest version for this phone number within the same team
        const [existingCustomer] = await connection.query(
            `WITH LatestVersions AS (
                SELECT 
                    c.*,
                    CASE 
                        WHEN C_unique_id REGEXP '__[0-9]+$' 
                        THEN CAST(SUBSTRING_INDEX(C_unique_id, '__', -1) AS UNSIGNED)
                        ELSE 0 
                    END as version_num,
                    SUBSTRING_INDEX(C_unique_id, '__', 1) as base_id
                FROM customers c
                WHERE phone_no_primary = ?
                AND QUEUE_NAME = ?
            )
            SELECT * FROM LatestVersions 
            ORDER BY 
                base_id,
                version_num DESC,
                id DESC 
            LIMIT 1`,
            [phone, team]
        );

        if (existingCustomer.length > 0) {
            const latestRecord = existingCustomer[0];
            const existingId = latestRecord.C_unique_id;
            const baseUniqueId = existingId.includes('__') ? existingId.split('__')[0] : existingId;
            
            // Get all versions for this base ID in this team
            const [versions] = await connection.query(
                `SELECT 
                    C_unique_id,
                    CASE 
                        WHEN C_unique_id REGEXP '__[0-9]+$' 
                        THEN CAST(SUBSTRING_INDEX(C_unique_id, '__', -1) AS UNSIGNED)
                        ELSE 0 
                    END as version_num
                FROM customers 
                WHERE QUEUE_NAME = ?
                AND (
                    C_unique_id = ? 
                    OR C_unique_id REGEXP ?
                )
                ORDER BY version_num DESC
                LIMIT 1`,
                [team, baseUniqueId, `^${baseUniqueId}__[0-9]+$`]
            );

            let nextVersion = 1;
            const latestVersionId = versions[0]?.C_unique_id || baseUniqueId;
            if (versions.length > 0) {
                const currentId = versions[0].C_unique_id;
                if (currentId.includes('__')) {
                    const currentVersion = parseInt(currentId.split('__')[1]);
                    if (!isNaN(currentVersion)) {
                        nextVersion = currentVersion + 1;
                    }
                }
            }

            return res.json({
                exists: true,
                latestVersion: latestVersionId,
                suggestedId: `${baseUniqueId}__${nextVersion}`,
                message: `Customer exists with version ${latestVersionId}.`,
                existingCustomer: {
                    customer_name: latestRecord.customer_name,
                    phone_no_primary: latestRecord.phone_no_primary,
                    phone_no_secondary: latestRecord.phone_no_secondary,
                    email_id: latestRecord.email_id,
                    address: latestRecord.address,
                    country: latestRecord.country,
                    designation: latestRecord.designation,
                    disposition: latestRecord.disposition,
                    comment: latestRecord.comment,
                    QUEUE_NAME: latestRecord.QUEUE_NAME
                }
            });
        }

        res.json({
            exists: false
        });
    } catch (error) {
        console.error('Error checking customer:', error);
        res.status(500).json({
            error: 'Failed to check customer'
        });
    }
};

export const createCustomer = async (req, res) => {
    const pool = await connectDB();
    let connection;
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        const { 
            customer_name, phone_no_primary, phone_no_secondary, 
            email_id, address, country, disposition, designation,
            QUEUE_NAME, comment, scheduled_at 
        } = req.body;

        // Check if user is an admin
        const [adminResult] = await connection.query(
            'SELECT id FROM admin WHERE id = ?',
            [req.user.userId]
        );
        const isAdmin = adminResult.length > 0;

        console.log('Attempting to find team with name:', QUEUE_NAME);
        // Convert spaces to underscores to match database format
        const formattedQueueName = QUEUE_NAME.replace(/\s+/g, '_');
        const [teamResult] = await connection.query(
            'SELECT id FROM teams WHERE team_name = ?',
            [formattedQueueName]
        );
        console.log('Team search result:', teamResult);

        if (!teamResult || teamResult.length === 0) {
            throw new Error('Invalid team name');
        }

        const team_id = teamResult[0].id;

        // Initialize C_unique_id variable
        let C_unique_id;

        // Check if customer already exists in this queue to handle versioning
        const [existingCustomer] = await connection.query(
            `WITH LatestVersions AS (
                SELECT 
                    c.*,
                    CASE 
                        WHEN C_unique_id REGEXP '__[0-9]+$' 
                        THEN CAST(SUBSTRING_INDEX(C_unique_id, '__', -1) AS UNSIGNED)
                        ELSE 0 
                    END as version_num,
                    SUBSTRING_INDEX(C_unique_id, '__', 1) as base_id
                FROM customers c
                WHERE QUEUE_NAME = ? 
                AND phone_no_primary = ?
                AND team_id = ?
            )
            SELECT * FROM LatestVersions 
            ORDER BY 
                base_id,
                version_num DESC,
                id DESC 
            LIMIT 1`,
            [QUEUE_NAME, phone_no_primary, team_id]
        );

        if (existingCustomer.length > 0) {
            const latestRecord = existingCustomer[0];
            console.log('Found latest record:', latestRecord);

            // Get base ID from the latest record
            const existingId = latestRecord.C_unique_id;
            const baseUniqueId = existingId.includes('__') ? existingId.split('__')[0] : existingId;
            
            // Get all versions for this base ID
            const [versions] = await connection.query(
                `SELECT 
                    C_unique_id,
                    CASE 
                        WHEN C_unique_id REGEXP '__[0-9]+$' 
                        THEN CAST(SUBSTRING_INDEX(C_unique_id, '__', -1) AS UNSIGNED)
                        ELSE 0 
                    END as version_num
                FROM customers 
                WHERE team_id = ? 
                AND (
                    C_unique_id = ? 
                    OR C_unique_id REGEXP ?
                )
                ORDER BY version_num DESC
                LIMIT 1`,
                [team_id, baseUniqueId, `^${baseUniqueId}__[0-9]+$`]
            );

            let nextVersion = 1;
            const latestVersionId = versions[0]?.C_unique_id || baseUniqueId;
            if (versions.length > 0) {
                const currentId = versions[0].C_unique_id;
                if (currentId.includes('__')) {
                    const currentVersion = parseInt(currentId.split('__')[1]);
                    if (!isNaN(currentVersion)) {
                        nextVersion = currentVersion + 1;
                    }
                }
            }

            C_unique_id = `${baseUniqueId}__${nextVersion}`;
            console.log(`Latest version found: ${latestVersionId}, creating new version: ${C_unique_id}`);

            // If this is a POST request, create the new version
            if (req.method === 'POST') {
                // Continue with customer creation using the new C_unique_id
                const formattedScheduledAt = scheduled_at && scheduled_at.trim() !== '' 
                    ? new Date(scheduled_at).toISOString().slice(0, 19).replace('T', ' ')
                    : null;

                // Try to insert with this ID
                const [result] = await connection.query(
                    `INSERT INTO customers (
                        customer_name, 
                        phone_no_primary, 
                        phone_no_secondary,
                        email_id, 
                        address,
                        country, 
                        designation,
                        disposition, 
                        QUEUE_NAME, 
                        team_id,
                        agent_name, 
                        C_unique_id, 
                        comment, 
                        scheduled_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        customer_name,
                        phone_no_primary,
                        phone_no_secondary || null,
                        email_id || null,
                        address || null,
                        country || null,
                        designation || null,
                        disposition || 'interested',
                        QUEUE_NAME,
                        team_id,
                        isAdmin ? null : req.user.username,
                        C_unique_id,
                        comment || null,
                        formattedScheduledAt
                    ]
                );

                await connection.commit();

                // Get the newly created record
                const [newRecord] = await connection.query(
                    `SELECT * FROM customers WHERE id = ?`,
                    [result.insertId]
                );

                return res.json({
                    success: true,
                    message: 'New version created successfully',
                    customerId: result.insertId,
                    C_unique_id,
                    customer: newRecord[0]
                });
            }

            // If this is not a POST request, just return the version info
            return res.status(400).json({
                success: false,
                message: `Customer exists with version ${latestVersionId}.`,
                existingCustomer: latestRecord,
                baseId: baseUniqueId,
                currentVersion: latestVersionId,
                nextVersion: nextVersion,
                suggestedId: C_unique_id
            });
        } else {
            // New customer, generate new base ID
            C_unique_id = await generateNextUniqueId(connection, QUEUE_NAME, phone_no_primary, team_id);
            console.log('Generated new base ID:', C_unique_id);
        }

        // Format scheduled_at or set to NULL if empty
        const formattedScheduledAt = scheduled_at && scheduled_at.trim() !== '' 
            ? new Date(scheduled_at).toISOString().slice(0, 19).replace('T', ' ')
            : null;

        // Try to insert with this ID
        const [result] = await connection.query(
            `INSERT INTO customers (
                customer_name, 
                phone_no_primary, 
                phone_no_secondary,
                email_id, 
                address,
                country, 
                designation,
                disposition, 
                QUEUE_NAME, 
                team_id,
                agent_name, 
                C_unique_id, 
                comment, 
                scheduled_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                customer_name,
                phone_no_primary,
                phone_no_secondary || null,
                email_id || null,
                address || null,
                country || null,
                designation || null,
                disposition || 'interested',
                QUEUE_NAME,
                team_id,
                isAdmin ? null : req.user.username,
                C_unique_id,
                comment || null,
                formattedScheduledAt
            ]
        );

        await connection.commit();

        // Get the newly created record
        const [newRecord] = await connection.query(
            `SELECT * FROM customers WHERE id = ?`,
            [result.insertId]
        );

        res.json({
            success: true,
            message: 'Customer created successfully',
            customerId: result.insertId,
            C_unique_id,
            customer: newRecord[0]
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error('Error creating customer:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create customer',
            error: error.message
        });
    } finally {
        if (connection) {
            try {
                connection.release();
            } catch (err) {
                console.error('Error releasing connection:', err);
            }
        }
    }
};