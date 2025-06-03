// src/controllers/roles/businessCenter.js

import connectDB from '../../db/index.js';

// Create a new business
export const createBusiness = async (req, res) => {
    let conn;
    try {
        const pool = connectDB();
        conn = await pool.getConnection();

        const {
            business_name,
            business_phone,
            business_whatsapp,
            business_email,
            business_password,
            business_person,
            business_address,
            business_country,
            business_tax_id,
            business_reg_no,
            other_detail,
            brand_id
        } = req.body;

        if (!business_name || !brand_id) {
            return res.status(400).json({ message: 'Business name and brand ID are required' });
        }

        await conn.beginTransaction();

        const [result] = await conn.query(
            `INSERT INTO business_center (
                business_name, business_phone, business_whatsapp, business_email,
                business_password, business_person, business_address, business_country, business_tax_id, business_reg_no,
                other_detail, brand_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                business_name, business_phone, business_whatsapp, business_email,
                business_password, business_person, business_address, business_country, business_tax_id, business_reg_no,
                other_detail, brand_id
            ]
        );

        await conn.commit();
        
        const [newBusiness] = await conn.query(
            'SELECT * FROM business_center WHERE id = ?',
            [result.insertId]
        );

        res.status(201).json({
            message: 'Business created successfully',
            business: newBusiness[0]
        });

    } catch (error) {
        if (conn) {
            await conn.rollback();
        }
        console.error('Error creating business:', error);
        res.status(500).json({ message: 'Error creating business' });
    } finally {
        if (conn) {
            conn.release();
        }
    }
};

// Get all businesses
export const getAllBusinesses = async (req, res) => {
    let conn;
    try {
        const pool = connectDB();
        conn = await pool.getConnection();

        // Get user info from authenticated user
        const isAdmin = req.user.isAdmin || req.user.role === 'admin';
        const brand_id = req.user.brand_id;

        console.log('User requesting businesses:', {
            isAdmin,
            brand_id,
            role: req.user.role,
            userId: req.user.userId,
            fullUser: req.user
        });

        // Modified query to include brand name
        let query = `
            SELECT bc.*, b.brand_name 
            FROM business_center bc
            LEFT JOIN brand b ON bc.brand_id = b.id
        `;
        let params = [];

        // Admin users can see all business centers
        // Non-admin users only see their brand's business centers
        if (!isAdmin && brand_id) {
            query += ' WHERE bc.brand_id = ?';
            params.push(brand_id);
        }

        query += ' ORDER BY bc.created_at DESC';
        console.log('Executing query:', query, 'with params:', params);

        const [businesses] = await conn.query(query, params);
        console.log(`Found ${businesses.length} businesses`);

        if (businesses.length === 0) {
            console.log('No businesses found for query');
        }

        res.json(businesses);

    } catch (error) {
        console.error('Error fetching businesses:', error);
        res.status(500).json({ 
            message: 'Error fetching businesses',
            error: error.message,
            stack: error.stack
        });
    } finally {
        if (conn) {
            conn.release();
        }
    }
};

// Get business by ID
export const getBusinessById = async (req, res) => {
    let conn;
    try {
        const pool = connectDB();
        conn = await pool.getConnection();

        const [business] = await conn.query(
            'SELECT * FROM business_center WHERE id = ?',
            [req.params.id]
        );

        if (business.length === 0) {
            return res.status(404).json({ message: 'Business not found' });
        }

        res.json(business[0]);

    } catch (error) {
        console.error('Error fetching business:', error);
        res.status(500).json({ message: 'Error fetching business' });
    } finally {
        if (conn) {
            conn.release();
        }
    }
};

// Update business
export const updateBusiness = async (req, res) => {
    let conn;
    try {
        const pool = connectDB();
        conn = await pool.getConnection();

        const {
            business_name,
            business_phone,
            business_whatsapp,
            business_email,
            business_password,
            business_person,
            business_address,
            business_country,
            business_tax_id,
            business_reg_no,
            other_detail,
            brand_id
        } = req.body;

        await conn.beginTransaction();

        const [result] = await conn.query(
            `UPDATE business_center SET
                business_name = ?,
                business_phone = ?,
                business_whatsapp = ?,
                business_email = ?,
                business_password = ?,
                business_person = ?,
                business_address = ?,
                business_country = ?,
                business_tax_id = ?,
                business_reg_no = ?,
                other_detail = ?,
                brand_id = ?
            WHERE id = ?`,
            [
                business_name,
                business_phone,
                business_whatsapp,
                business_email,
                business_password,
                business_person,
                business_address,
                business_country,
                business_tax_id,
                business_reg_no,
                other_detail,
                brand_id,
                req.params.id
            ]
        );

        if (result.affectedRows === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Business not found' });
        }

        await conn.commit();

        const [updatedBusiness] = await conn.query(
            'SELECT * FROM business_center WHERE id = ?',
            [req.params.id]
        );

        res.json({
            message: 'Business updated successfully',
            business: updatedBusiness[0]
        });

    } catch (error) {
        if (conn) {
            await conn.rollback();
        }
        console.error('Error updating business:', error);
        res.status(500).json({ message: 'Error updating business' });
    } finally {
        if (conn) {
            conn.release();
        }
    }
};

// Delete business
export const deleteBusiness = async (req, res) => {
    let conn;
    try {
        const pool = connectDB();
        conn = await pool.getConnection();

        await conn.beginTransaction();

        const [result] = await conn.query(
            'DELETE FROM business_center WHERE id = ?',
            [req.params.id]
        );

        if (result.affectedRows === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Business not found' });
        }

        await conn.commit();

        res.json({ message: 'Business deleted successfully' });

    } catch (error) {
        if (conn) {
            await conn.rollback();
        }
        console.error('Error deleting business:', error);
        res.status(500).json({ message: 'Error deleting business' });
    } finally {
        if (conn) {
            conn.release();
        }
    }
};

// Get business details with teams and receptionists
export const getBusinessDetails = async (req, res) => {
    let conn;
    try {
        const pool = connectDB();
        conn = await pool.getConnection();

        const businessId = req.params.id;

        // Get business details with teams and their members
        const [business] = await conn.query(
            `SELECT 
                bc.*,
                JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'team_id', t.id,
                        'team_name', t.team_name,
                        'team_detail', t.team_detail,
                        'associates', (
                            SELECT JSON_ARRAYAGG(
                                JSON_OBJECT(
                                    'id', tm.id,
                                    'username', tm.username,
                                    'email', tm.email,
                                    'designation', tm.designation
                                )
                            )
                            FROM team_members tm
                            WHERE tm.team_id = t.id
                        )
                    )
                ) as companies,
                (
                    SELECT JSON_ARRAYAGG(
                        JSON_OBJECT(
                            'id', r.id,
                            'name', r.receptionist_name,
                            'email', r.receptionist_email,
                            'phone', r.receptionist_phone
                        )
                    )
                    FROM receptionist r
                    WHERE r.business_center_id = bc.id
                ) as receptionists
            FROM business_center bc
            LEFT JOIN teams t ON t.business_center_id = bc.id
            WHERE bc.id = ?
            GROUP BY bc.id`,
            [businessId]
        );

        if (business.length === 0) {
            return res.status(404).json({ message: 'Business not found' });
        }

        res.json(business[0]);

    } catch (error) {
        console.error('Error fetching business details:', error);
        res.status(500).json({ message: 'Error fetching business details' });
    } finally {
        if (conn) {
            conn.release();
        }
    }
};

// Get teams for a business center
export const getBusinessTeams = async (req, res) => {
    let conn;
    try {
        const pool = connectDB();
        conn = await pool.getConnection();
        const businessId = req.params.id;

        const [teams] = await conn.query(
            `SELECT t.*, u.username as created_by_name 
             FROM teams t 
             JOIN users u ON t.created_by = u.id 
             WHERE t.business_center_id = ?
             ORDER BY t.created_at DESC`,
            [businessId]
        );

        res.json({
            teams: teams
        });

    } catch (error) {
        console.error('Error fetching teams:', error);
        res.status(500).json({ message: 'Error fetching teams' });
    } finally {
        if (conn) {
            conn.release();
        }
    }
};

// Get all teams in a business center
export const getAllBusinessTeams = async (req, res) => {
    let conn;
    try {
        const pool = connectDB();
        conn = await pool.getConnection();

        const businessId = req.params.id;

        const [teams] = await conn.query(
            `SELECT t.*, 
                COUNT(tm.id) as total_associates,
                JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'id', tm.id,
                        'username', tm.username,
                        'email', tm.email,
                        'designation', tm.designation
                    )
                ) as associates
            FROM teams t
            LEFT JOIN team_members tm ON tm.team_id = t.id
            WHERE t.business_center_id = ?
            GROUP BY t.id
            ORDER BY t.created_at DESC`,
            [businessId]
        );

        res.json(teams);

    } catch (error) {
        console.error('Error fetching business teams:', error);
        res.status(500).json({ message: 'Error fetching business teams' });
    } finally {
        if (conn) {
            conn.release();
        }
    }
};

// Get all receptionists in a business center
export const getBusinessReceptionists = async (req, res) => {
    let conn;
    try {
        const pool = connectDB();
        conn = await pool.getConnection();

        const businessId = req.params.id;

        const [receptionists] = await conn.query(
            `SELECT * FROM receptionist 
            WHERE business_center_id = ?
            ORDER BY created_at DESC`,
            [businessId]
        );

        res.json(receptionists);

    } catch (error) {
        console.error('Error fetching business receptionists:', error);
        res.status(500).json({ message: 'Error fetching business receptionists' });
    } finally {
        if (conn) {
            conn.release();
        }
    }
};

// Create teams for a business center
export const createBusinessTeams = async (req, res) => {
    let conn;
    try {
        const pool = connectDB();
        conn = await pool.getConnection();
        const businessId = req.params.id;
        const { teams } = req.body;
        const userId = req.user.userId; // Get user ID from JWT token

        if (!Array.isArray(teams)) {
            return res.status(400).json({ message: 'Teams must be an array' });
        }

        await conn.beginTransaction();

        // Get brand_id from business center
        const [businessCenter] = await conn.query(
            'SELECT brand_id FROM business_center WHERE id = ?',
            [businessId]
        );

        if (businessCenter.length === 0) {
            await conn.rollback();
            throw new Error('Business center not found');
        }

        const brand_id = businessCenter[0].brand_id;

        const createdTeams = [];
        for (const team of teams) {
            const {
                team_name,
                tax_id,
                reg_no,
                team_phone,
                team_email,
                team_address,
                team_country,
                team_prompt,
                team_detail
            } = team;

            if (!team_name) {
                await conn.rollback();
                return res.status(400).json({ message: 'Team name is required for all teams' });
            }

            // Convert spaces to underscores in team_name
            const formattedTeamName = team_name.replace(/\s+/g, '_');

            // Check if team already exists for this brand or business center
            const [existingTeam] = await conn.query(
                `SELECT id FROM teams 
                 WHERE (team_name = ? AND brand_id = ?) 
                 OR (team_name = ? AND business_center_id = ?)`,
                [formattedTeamName, brand_id, formattedTeamName, businessId]
            );

            if (existingTeam.length > 0) {
                await conn.rollback();
                return res.status(400).json({
                    message: `Team "${team_name}" already exists in this brand or business center`
                });
            }

            // Create the team
            const [result] = await conn.query(
                `INSERT INTO teams (
                    team_name, tax_id, reg_no, team_phone, team_email,
                    team_address, team_country, team_prompt, team_detail,
                    team_type, created_by, brand_id, business_center_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    formattedTeamName, tax_id, reg_no, team_phone, team_email,
                    team_address, team_country, team_prompt, team_detail,
                    'department', userId, brand_id, businessId
                ]
            );

            createdTeams.push({
                id: result.insertId,
                team_name: formattedTeamName,
                tax_id,
                reg_no,
                team_phone,
                team_email,
                team_address,
                team_country,
                team_prompt,
                team_detail,
                business_center_id: businessId,
                brand_id,
                created_by: userId
            });
        }

        await conn.commit();
        
        res.status(201).json({
            message: 'Teams created successfully',
            teams: createdTeams
        });

    } catch (error) {
        if (conn) {
            await conn.rollback();
        }
        console.error('Error creating teams:', error);
        res.status(500).json({ message: 'Error creating teams' });
    } finally {
        if (conn) {
            conn.release();
        }
    }
};

// Create an associate for a business center
export const createBusinessAssociate = async (req, res) => {
    let conn;
    try {
        const pool = connectDB();
        conn = await pool.getConnection();
        const businessId = req.params.id;
        const { username, email, mobile_num, mobile_num_2, team_id, department, designation } = req.body;

        // Start transaction
        await conn.beginTransaction();

        try {
            // Validate required fields
            if (!username || !email || !mobile_num || !team_id) {
                throw new Error('Username, email, mobile number, and team ID are required');
            }

            // Check if team belongs to the business center and get brand_id
            const [teamCheck] = await conn.query(
                'SELECT t.id, bc.brand_id FROM teams t JOIN business_center bc ON t.business_center_id = bc.id WHERE t.id = ? AND t.business_center_id = ?',
                [team_id, businessId]
            );

            if (teamCheck.length === 0) {
                throw new Error('Invalid team ID for this business center');
            }

            // Get brand limits and current count
            const [brandLimits] = await conn.query(
                'SELECT associates FROM brand WHERE id = ?',
                [teamCheck[0].brand_id]
            );

            const [currentCount] = await conn.query(
                `SELECT COUNT(*) as count FROM team_members tm 
                 JOIN teams t ON tm.team_id = t.id 
                 JOIN business_center bc ON t.business_center_id = bc.id 
                 WHERE bc.brand_id = ?`,
                [teamCheck[0].brand_id]
            );

            if (currentCount[0].count >= brandLimits[0].associates) {
                throw new Error(`Cannot create more associates. Brand limit (${brandLimits[0].associates}) reached.`);
            }

            // Check for existing user with same username or email only within the same team
            const [existingUser] = await conn.query(
                'SELECT id FROM team_members WHERE (username = ? OR email = ? OR mobile_num = ?) AND team_id = ?',
                [username, email, mobile_num, team_id]
            );

            if (existingUser.length > 0) {
                throw new Error('Username, email, or mobile number already exists in this team');
            }

            // Create the team member
            const [result] = await conn.query(
                `INSERT INTO team_members (
                    username,
                    email,
                    mobile_num,
                    mobile_num_2,
                    department,
                    designation,
                    team_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [username, email, mobile_num, mobile_num_2, department, designation, team_id]
            );

            await conn.commit();

            res.status(201).json({
                message: 'Associate created successfully',
                associate: {
                    id: result.insertId,
                    username,
                    email,
                    mobile_num,
                    mobile_num_2,   
                    department,
                    designation,
                    team_id
                }
            });

        } catch (error) {
            await conn.rollback();
            throw error;
        }

    } catch (error) {
        console.error('Error creating associate:', error);
        res.status(400).json({ 
            message: error.message || 'Error creating associate',
            field: error.field
        });
    } finally {
        if (conn) {
            conn.release();
        }
    }
};

// Get business counts
export const getBusinessCounts = async (req, res) => {
    let conn;
    try {
        const pool = connectDB();
        conn = await pool.getConnection();
        const businessId = req.params.id;

        // First get the brand_id for this business center
        const [business] = await conn.query(
            'SELECT brand_id FROM business_center WHERE id = ?',
            [businessId]
        );

        if (business.length === 0) {
            return res.status(404).json({ message: 'Business center not found' });
        }

        const brandId = business[0].brand_id;

        // Get total teams count for the brand
        const [teamsCount] = await conn.query(
            `SELECT COUNT(*) as count FROM teams t 
             WHERE t.brand_id = ? OR EXISTS (
                SELECT 1 FROM business_center bc 
                WHERE bc.id = t.business_center_id AND bc.brand_id = ?
             )`,
            [brandId, brandId]
        );

        // Get total receptionists count for the brand
        const [receptionistsCount] = await conn.query(
            `SELECT COUNT(*) as count FROM receptionist r 
             JOIN business_center bc ON r.business_center_id = bc.id 
             WHERE bc.brand_id = ?`,
            [brandId]
        );

        // Get total associates count for the brand
        const [associatesCount] = await conn.query(
            `SELECT COUNT(*) as count FROM team_members tm 
             JOIN teams t ON tm.team_id = t.id 
             WHERE t.brand_id = ? OR EXISTS (
                SELECT 1 FROM business_center bc 
                WHERE bc.id = t.business_center_id AND bc.brand_id = ?
             )`,
            [brandId, brandId]
        );

        res.json({
            totalTeams: teamsCount[0].count,
            totalReceptionists: receptionistsCount[0].count,
            totalAssociates: associatesCount[0].count
        });

    } catch (error) {
        console.error('Error getting business counts:', error);
        res.status(500).json({ message: 'Error getting business counts' });
    } finally {
        if (conn) {
            conn.release();
        }
    }
};

// Get teams for a business center (receptionist access)
export const getBusinessCenterTeams = async (req, res) => {
    let conn;
    try {
        const pool = connectDB();
        conn = await pool.getConnection();
        const businessCenterId = req.params.id;
        const user = req.user;

        // Verify user is a receptionist and has access to this business center
        if (user.role !== 'receptionist') {
            return res.status(403).json({ 
                message: 'Access denied. Only receptionists can access this endpoint.'
            });
        }

        // Check if user has access to this business center
        const [userAccess] = await conn.query(
            `SELECT u.* 
             FROM users u
             WHERE u.id = ? 
             AND u.business_center_id = ?
             AND u.role_id = (SELECT id FROM roles WHERE role_name = 'receptionist')`,
            [user.userId, businessCenterId]
        );

        if (userAccess.length === 0) {
            return res.status(403).json({ 
                message: 'Access denied. Receptionist does not belong to this business center.'
            });
        }

        // Get teams for this business center
        const [teams] = await conn.query(
            `SELECT t.*, u.username as created_by_name 
             FROM teams t 
             JOIN users u ON t.created_by = u.id 
             WHERE t.business_center_id = ?
             ORDER BY t.created_at DESC`,
            [businessCenterId]
        );

        res.json({
            teams: teams
        });

    } catch (error) {
        console.error('Error fetching business center teams:', error);
        res.status(500).json({ message: 'Error fetching teams' });
    } finally {
        if (conn) {
            conn.release();
        }
    }
};