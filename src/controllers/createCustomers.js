// src/controllers/createCustomer.js

import connectDB from '../db/index.js';

// Helper function to format date
const formatDate = (dateStr) => {
    if (!dateStr) return null;
    
    // Convert to string and trim
    const strDate = String(dateStr).trim();
    if (!strDate) return null;

    try {
        // First try to handle Excel date number (days since December 30, 1899)
        const numericDate = Number(strDate.replace(/[^0-9]/g, ''));
        if (!isNaN(numericDate)) {
            // Excel date starting point (December 30, 1899)
            const excelEpoch = new Date(1899, 11, 30);
            const date = new Date(excelEpoch.getTime() + (numericDate * 24 * 60 * 60 * 1000));
            
            // Validate the resulting date
            if (!isNaN(date.getTime()) && date.getFullYear() >= 2000 && date.getFullYear() <= 2100) {
                return date.toISOString().slice(0, 10);
            }
        }

        // Try DD/MM/YYYY format
        const parts = strDate.split('/');
        if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10);
            const year = parseInt(parts[2], 10);

            if (day > 0 && day <= 31 && 
                month > 0 && month <= 12 && 
                year >= 2000 && year <= 2100) {
                const paddedDay = day.toString().padStart(2, '0');
                const paddedMonth = month.toString().padStart(2, '0');
                return `${year}-${paddedMonth}-${paddedDay}`;
            }
        }

        // Try parsing as regular date string
        const date = new Date(strDate);
        if (!isNaN(date.getTime()) && date.getFullYear() >= 2000 && date.getFullYear() <= 2100) {
            return date.toISOString().slice(0, 10);
        }

        console.warn(`Invalid date format for value: ${strDate}`);
        return null;
    } catch (error) {
        console.error(`Error formatting date: ${strDate}`, error);
        return null;
    }
};

export const makeNewRecord = async (req, res) => {
    let connection;
    try {
        // Check if user exists in request
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        connection = await connectDB();

        // Constants for ENUM values matching database schema exactly
        const VALID_DISPOSITIONS = ['interested', 'not interested', 'follow up', 'converted', 'spam'];
        const VALID_GENDERS = ['male', 'female', 'other'];
        const VALID_CONTACT_TYPES = ['lead', 'customer', 'partner', 'vendor'];

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
            first_name, middle_name, last_name,
            phone_no_primary, phone_no_secondary, whatsapp_num,
            email_id, date_of_birth, gender, address,
            country, company_name, designation, website,
            other_location, contact_type, source,
            disposition, agent_name, comment,
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
            if (whatsapp_num) validateMobileNumber(whatsapp_num);
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
        if (isValidValue(whatsapp_num)) {
            conditions.push('(whatsapp_num = ? AND whatsapp_num IS NOT NULL AND whatsapp_num != "")');
            params.push(whatsapp_num);
        }

        if (conditions.length > 0) {
            const [existRecords] = await connection.query(`
                SELECT phone_no_primary, phone_no_secondary, whatsapp_num
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
                    if (isValidValue(whatsapp_num) && isValidValue(record.whatsapp_num) && record.whatsapp_num === whatsapp_num) {
                        errors.push('This whatsapp number is already registered in our system');
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
            first_name: validateVarchar(first_name, 100),
            middle_name: validateVarchar(middle_name, 100),
            last_name: validateVarchar(last_name, 100),
            phone_no_primary: validateMobileNumber(phone_no_primary),
            phone_no_secondary: validateMobileNumber(phone_no_secondary),
            whatsapp_num: validateMobileNumber(whatsapp_num),
            email_id: validateVarchar(email_id, 100),
            date_of_birth: formatDate(date_of_birth),
            gender: validateEnum(gender, VALID_GENDERS, 'male'),
            address: address || null,
            country: validateVarchar(country, 15),
            company_name: validateVarchar(company_name, 100),
            designation: validateVarchar(designation, 100),
            website: validateVarchar(website, 100),
            other_location: validateVarchar(other_location, 255),
            contact_type: validateEnum(contact_type, VALID_CONTACT_TYPES, null),
            source: validateVarchar(source, 100),
            disposition: validateEnum(disposition, VALID_DISPOSITIONS, 'interested'),
            agent_name: validateVarchar(agent_name || req.user.username, 100),
            comment: validateVarchar(comment, 255),
            scheduled_at: formatMySQLDateTime(scheduled_at) || formatMySQLDateTime(new Date())
        };

        // Get the latest C_unique_id
        const [lastIdResult] = await connection.query(
            'SELECT C_unique_id FROM customers ORDER BY CAST(SUBSTRING(C_unique_id, 4) AS UNSIGNED) DESC LIMIT 1'
        );
        
        const lastId = lastIdResult[0]?.C_unique_id || 'MC_0';
        const lastNumericPart = parseInt(lastId.split('_')[1]) || 0;
        const nextUniqueId = `MC_${lastNumericPart + 1}__1`;

        const sql = `INSERT INTO customers (
                first_name, middle_name, last_name,
                phone_no_primary, phone_no_secondary, whatsapp_num,
                email_id, gender, address,
                country, company_name, designation, website,
                other_location, contact_type, source,
                disposition, agent_name, C_unique_id, date_of_birth, comment, scheduled_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        const values = [
            validatedData.first_name,
            validatedData.middle_name,
            validatedData.last_name,
            validatedData.phone_no_primary,
            validatedData.phone_no_secondary,
            validatedData.whatsapp_num,
            validatedData.email_id,
            validatedData.gender,
            validatedData.address,
            validatedData.country,
            validatedData.company_name,
            validatedData.designation,
            validatedData.website,
            validatedData.other_location,
            validatedData.contact_type,
            validatedData.source,
            validatedData.disposition,
            validatedData.agent_name,
            nextUniqueId,
            validatedData.date_of_birth,
            validatedData.comment,
            validatedData.scheduled_at
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
const checkDuplicates = async (connection, phone_no_primary, email_id, first_name) => {
    const duplicates = {
        exists: false,
        phone_no_primary_exists: false,
        email_exists: false,
        existing_record: null
    };

    if (phone_no_primary) {
        const [phoneResults] = await connection.query(
            'SELECT * FROM customers WHERE phone_no_primary = ?',
            [phone_no_primary]
        );
        if (phoneResults.length > 0) {
            duplicates.exists = true;
            duplicates.phone_no_primary_exists = true;
            duplicates.existing_record = phoneResults[0];
        }
    }

    if (email_id && !duplicates.exists) {
        const [emailResults] = await connection.query(
            'SELECT * FROM customers WHERE email_id = ?',
            [email_id]
        );
        if (emailResults.length > 0) {
            duplicates.exists = true;
            duplicates.email_exists = true;
            duplicates.existing_record = emailResults[0];
        }
    }

    // Check for duplicates based on phone number AND first name
    if (phone_no_primary && first_name && !duplicates.exists) {
        const [phoneResults] = await connection.query(
            'SELECT * FROM customers WHERE phone_no_primary = ? AND first_name = ?',
            [phone_no_primary, first_name]
        );
        if (phoneResults.length > 0) {
            duplicates.exists = true;
            duplicates.phone_no_primary_exists = true;
            duplicates.existing_record = phoneResults[0];
        }
    }

    // Check for duplicates based on email AND first name
    if (email_id && first_name && !duplicates.exists) {
        const [emailResults] = await connection.query(
            'SELECT * FROM customers WHERE email_id = ? AND first_name = ?',
            [email_id, first_name]
        );
        if (emailResults.length > 0) {
            duplicates.exists = true;
            duplicates.email_exists = true;
            duplicates.existing_record = emailResults[0];
        }
    }

    return duplicates;
};

// Function to handle duplicate records
const handleDuplicate = async (connection, customerData, existingRecord, action) => {
    try {
        if (action === 'skip') {
            return { success: false, message: 'Record skipped due to duplicate' };
        }

        if (action === 'replace') {
            // Get column names for update
            const [columns] = await connection.query('SHOW COLUMNS FROM customers');
            const columnNames = columns.map(col => col.Field)
                .filter(name => !['id', 'C_unique_id', 'date_created', 'last_updated', 'scheduled_at'].includes(name));

            const updateQuery = `UPDATE customers SET ${
                columnNames.map(col => `${col} = ?`).join(', ')
            }, last_updated = NOW() WHERE id = ?`;

            const values = columnNames.map(colName => {
                return customerData[colName] || null;
            });

            // Add WHERE clause value
            values.push(existingRecord.id);

            // Execute the update
            await connection.query(updateQuery, values);
            
            // Return the existing record with its C_unique_id preserved
            customerData.C_unique_id = existingRecord.C_unique_id;
            return { success: true, data: customerData, replaced: true };
        }

        if (action === 'append') {
            // Get the base C_unique_id from the existing record
            const baseId = existingRecord.C_unique_id.split('__')[0];
            
            // Find all records with this base ID to determine next suffix
            const [suffixResults] = await connection.query(
                'SELECT C_unique_id FROM customers WHERE C_unique_id LIKE ? OR C_unique_id = ? ORDER BY CAST(SUBSTRING_INDEX(C_unique_id, "__", -1) AS UNSIGNED) DESC LIMIT 1',
                [`${baseId}__%`, baseId]
            );
            
            let newCUniqueId;
            if (suffixResults.length === 0 || suffixResults[0].C_unique_id === baseId) {
                // No suffixed records exist yet
                newCUniqueId = `${baseId}__1`;
            } else {
                // Get the highest suffix and increment
                const currentId = suffixResults[0].C_unique_id;
                const currentSuffix = parseInt(currentId.split('__')[1]);
                newCUniqueId = `${baseId}__${currentSuffix + 1}`;
            }

            customerData.C_unique_id = newCUniqueId;
            return { success: true, data: customerData };
        }

        return { success: false, message: 'Invalid duplicate action' };
    } catch (error) {
        console.error('Error handling duplicate:', error);
        return { success: false, message: error.message };
    }
};

// Create new customer
export const createCustomer = async (req, res) => {
    let connection;
    try {
        // Check if user exists in request
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const pool = await connectDB();
        connection = await pool.getConnection();
        await connection.beginTransaction();

        let customerData = req.body;
        const duplicateAction = req.body.duplicateAction || 'skip'; // Get duplicate action from request

        // Check for duplicates
        const duplicates = await checkDuplicates(connection, customerData.phone_no_primary, customerData.email_id, customerData.first_name);

        if (duplicates.exists) {
            if (duplicateAction === 'prompt') {
                // Return duplicate info to frontend for user decision
                return res.status(409).json({
                    duplicate: true,
                    phone_no_primary_exists: duplicates.phone_no_primary_exists,
                    email_exists: duplicates.email_exists,
                    existing_record: duplicates.existing_record
                });
            }

            // Handle duplicate based on specified action
            const handleResult = await handleDuplicate(connection, customerData, duplicates.existing_record, duplicateAction);
            
            if (!handleResult.success) {
                return res.status(400).json({ message: handleResult.message });
            }
            
            // If the record was replaced, we don't need to insert a new one
            if (handleResult.replaced) {
                await connection.commit();
                return res.json({
                    success: true,
                    message: 'Customer updated successfully',
                    customerId: duplicates.existing_record.id,
                    C_unique_id: duplicates.existing_record.C_unique_id
                });
            }
            
            customerData = handleResult.data;
        }

        // Get the latest C_unique_id (only if not handling a duplicate)
        let nextId;
        if (!duplicates.exists || duplicateAction === 'skip') {
            const [lastIdResult] = await connection.query(
                'SELECT C_unique_id FROM customers ORDER BY CAST(SUBSTRING(C_unique_id, 4) AS UNSIGNED) DESC LIMIT 1'
            );
            
            const lastId = lastIdResult[0]?.C_unique_id || 'MC_0';
            const lastNumericPart = parseInt(lastId.split('_')[1]) || 0;
            nextId = `MC_${lastNumericPart + 1}`;
        } else {
            nextId = customerData.C_unique_id; // Use the ID generated by handleDuplicate
        }
    
        // Insert new customer
        const [result] = await connection.query(
            `INSERT INTO customers (
                first_name, middle_name, last_name,
                phone_no_primary, phone_no_secondary, whatsapp_num,
                email_id, gender, address,
                country, company_name, designation, website,
                other_location, contact_type, source,
                disposition, agent_name, C_unique_id, date_of_birth, comment, scheduled_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              customerData.first_name || null,
              customerData.middle_name || null,
              customerData.last_name || null,
              customerData.phone_no_primary || null,
              customerData.phone_no_secondary || null,
              customerData.whatsapp_num || null,
              customerData.email_id || null,
              customerData.gender || null,
              customerData.address || null,
              customerData.country || null,
              customerData.company_name || null,
              customerData.designation || null,
              customerData.website || null,
              customerData.other_location || null,
              customerData.contact_type || null,
              customerData.source || null,
              customerData.disposition || null,
              req.user.username, // Automatically use the authenticated user's username
              nextId,
              customerData.date_of_birth || null,
              customerData.comment || null,
              formatDate(customerData.scheduled_at) || null
            ]
          );
      
    
        await connection.commit();
    
        res.json({
            success: true,
            message: 'Customer created successfully',
            customerId: result.insertId,
            C_unique_id: nextId
        });
    
    } catch (error) {
        await connection.rollback();
        console.error('Error creating customer:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create customer',
            error: error.message
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};