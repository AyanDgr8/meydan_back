// src/controllers/businessCenter.js

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
                business_password, business_address, business_country, business_tax_id, business_reg_no,
                other_detail, brand_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                business_name, business_phone, business_whatsapp, business_email,
                business_password, business_address, business_country, business_tax_id, business_reg_no,
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

        // Get brand_id from authenticated user
        const brand_id = req.user.brand_id;

        const [businesses] = await conn.query(
            'SELECT * FROM business_center WHERE brand_id = ? ORDER BY created_at DESC',
            [brand_id]
        );

        res.json(businesses);

    } catch (error) {
        console.error('Error fetching businesses:', error);
        res.status(500).json({ message: 'Error fetching businesses' });
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

            const [result] = await conn.query(
                `INSERT INTO teams (
                    team_name,
                    tax_id,
                    reg_no,
                    team_phone,
                    team_email,
                    team_address,
                    team_country,
                    team_prompt,
                    team_detail,
                    business_center_id,
                    brand_id,
                    created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    team_name,
                    tax_id,
                    reg_no,
                    team_phone,
                    team_email,
                    team_address,
                    team_country,
                    team_prompt,
                    team_detail,
                    businessId,
                    brand_id,
                    userId
                ]
            );

            createdTeams.push({
                id: result.insertId,
                team_name,
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
        const { username, email, mobile_num, mobile_num_2, team_id, designation } = req.body;

        // Start transaction
        await conn.beginTransaction();

        try {
            // Validate required fields
            if (!username || !email || !mobile_num || !team_id) {
                throw new Error('Username, email, mobile number, and team ID are required');
            }

            // Check if team belongs to the business center
            const [teamCheck] = await conn.query(
                'SELECT id FROM teams WHERE id = ? AND business_center_id = ?',
                [team_id, businessId]
            );

            if (teamCheck.length === 0) {
                throw new Error('Invalid team ID for this business center');
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
                    designation,
                    team_id
                ) VALUES (?, ?, ?, ?, ?, ?)`,
                [username, email, mobile_num, mobile_num_2 || null, designation || null, team_id]
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