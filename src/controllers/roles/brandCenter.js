// src/controllers/brandCenter.js

import connectDB from '../../db/index.js';  
import nodemailer from 'nodemailer';
import bcrypt from 'bcrypt';

// Create nodemailer transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

const SALT_ROUNDS = 10;

// Create a new brand
export const createBrand = async (req, res) => {
    let conn;
    try {
        const pool = connectDB();
        conn = await pool.getConnection();

        const {
            brand_name,
            brand_phone,
            brand_email,
            brand_tax_id,
            brand_reg_no,
            companies,
            associates,
            receptionist,
            brand_other_detail
        } = req.body;

        if (!brand_name) {
            return res.status(400).json({ message: 'Brand name is required' });
        }

        await conn.beginTransaction();

        // Create default password hash
        const defaultPassword = '12345678';
        const hashedPassword = await bcrypt.hash(defaultPassword, SALT_ROUNDS);

        const [result] = await conn.query(
            `INSERT INTO brand (
                brand_name, brand_phone, brand_email, brand_password, 
                brand_tax_id, brand_reg_no, companies, associates, receptionist,
                brand_other_detail
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                brand_name, brand_phone, brand_email, hashedPassword, 
                brand_tax_id, brand_reg_no, companies, associates, receptionist, brand_other_detail
            ]
        );

        await conn.commit();
        
        const [newBrand] = await conn.query(
            'SELECT * FROM brand WHERE id = ?',
            [result.insertId]
        );

        // Send welcome email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: brand_email,
            subject: 'Welcome to Multycomm Business Center Services',
            html: `
                <h2>Welcome ${brand_name}!</h2>
                <p>Your account has been created successfully.</p>
                <p>You can now login to your account using your email and the default password: <strong>12345678</strong></p>
                <p>Please change your password after your first login.</p>
                <a href="${process.env.FRONTEND_URL}/login" style="display: inline-block; padding: 10px 20px; background-color: #1976d2; color: white; text-decoration: none; border-radius: 5px;">Login Now</a>
                <p>Best regards,<br>Team Multycomm</p>
            `
        };

        await transporter.sendMail(mailOptions);

        res.status(201).json({
            message: 'Brand created successfully and welcome email sent',
            brand: newBrand[0]
        });

    } catch (error) {
        if (conn) {
            await conn.rollback();
        }
        console.error('Error creating brand:', error);
        res.status(500).json({ message: 'Error creating brand' });
    } finally {
        if (conn) {
            conn.release();
        }
    }
};

// Get all brands
export const getAllBrands = async (req, res) => {
    let conn;
    try {
        const pool = connectDB();
        conn = await pool.getConnection();

        const [brands] = await conn.query(
            'SELECT * FROM brand ORDER BY created_at DESC'
        );

        res.json(brands);

    } catch (error) {
        console.error('Error fetching brands:', error);
        res.status(500).json({ message: 'Error fetching brands' });
    } finally {
        if (conn) {
            conn.release();
        }
    }
};

// Get brand by ID
export const getBrandById = async (req, res) => {
    let conn;
    try {
        const pool = connectDB();
        conn = await pool.getConnection();

        const [brand] = await conn.query(
            'SELECT * FROM brand WHERE id = ?',
            [req.params.id]
        );

        if (brand.length === 0) {
            return res.status(404).json({ message: 'Brand not found' });
        }

        res.json(brand[0]);

    } catch (error) {
        console.error('Error fetching brand:', error);
        res.status(500).json({ message: 'Error fetching brand' });
    } finally {
        if (conn) {
            conn.release();
        }
    }
};

// Update brand
export const updateBrand = async (req, res) => {
    let conn;
    try {
        const pool = connectDB();
        conn = await pool.getConnection();

        const {
            brand_name,
            brand_phone,
            brand_email,
            brand_password,
            brand_tax_id,
            brand_reg_no,
            companies,
            associates,
            receptionist,
            brand_other_detail
        } = req.body;

        await conn.beginTransaction();

        const [result] = await conn.query(
            `UPDATE brand SET
                brand_name = ?,
                brand_phone = ?,
                brand_email = ?,
                brand_password = ?,
                brand_tax_id = ?,
                brand_reg_no = ?,
                companies = ?,
                associates = ?,
                receptionist = ?,
                brand_other_detail = ?
            WHERE id = ?`,
            [
                brand_name,
                brand_phone,
                brand_email,
                brand_password,
                brand_tax_id,
                brand_reg_no,
                companies,
                associates,
                receptionist,
                brand_other_detail,
                req.params.id
            ]
        );

        if (result.affectedRows === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Brand not found' });
        }

        await conn.commit();

        const [updatedBrand] = await conn.query(
            'SELECT * FROM brand WHERE id = ?',
            [req.params.id]
        );

        res.json({
            message: 'Brand updated successfully',
            brand: updatedBrand[0]
        });

    } catch (error) {
        if (conn) {
            await conn.rollback();
        }
        console.error('Error updating brand:', error);
        res.status(500).json({ message: 'Error updating brand' });
    } finally {
        if (conn) {
            conn.release();
        }
    }
};

// Delete brand
export const deleteBrand = async (req, res) => {
    let conn;
    try {
        const pool = connectDB();
        conn = await pool.getConnection();

        await conn.beginTransaction();

        const [result] = await conn.query(
            'DELETE FROM brand WHERE id = ?',
            [req.params.id]
        );

        if (result.affectedRows === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Brand not found' });
        }

        await conn.commit();

        res.json({ message: 'Brand deleted successfully' });

    } catch (error) {
        if (conn) {
            await conn.rollback();
        }
        console.error('Error deleting brand:', error);
        res.status(500).json({ message: 'Error deleting brand' });
    } finally {
        if (conn) {
            conn.release();
        }
    }
};

// Get all business centers for a brand
export const getBrandBusinessCenters = async (req, res) => {
    let conn;
    try {
        const pool = connectDB();
        conn = await pool.getConnection();

        const brandId = req.params.brandId;

        const [businessCenters] = await conn.query(
            `SELECT bc.*, 
                COUNT(DISTINCT t.id) as total_companies,
                COUNT(DISTINCT tm.id) as total_associates,
                COUNT(DISTINCT r.id) as total_receptionists
            FROM business_center bc
            LEFT JOIN teams t ON t.business_center_id = bc.id
            LEFT JOIN team_members tm ON tm.team_id = t.id
            LEFT JOIN receptionist r ON r.business_center_id = bc.id
            WHERE bc.brand_id = ?
            GROUP BY bc.id
            ORDER BY bc.created_at DESC`,
            [brandId]
        );

        res.json(businessCenters);

    } catch (error) {
        console.error('Error fetching brand business centers:', error);
        res.status(500).json({ message: 'Error fetching brand business centers' });
    } finally {
        if (conn) {
            conn.release();
        }
    }
};

// Get brand hierarchy details
export const getBrandHierarchy = async (req, res) => {
    let conn;
    try {
        const pool = connectDB();
        conn = await pool.getConnection();

        const brandId = req.params.brandId;

        // Get brand details
        const [brand] = await conn.query(
            'SELECT * FROM brand WHERE id = ?',
            [brandId]
        );

        if (brand.length === 0) {
            return res.status(404).json({ message: 'Brand not found' });
        }

        // Get business centers with their companies and receptionists
        const [businessCenters] = await conn.query(
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
            WHERE bc.brand_id = ?
            GROUP BY bc.id`,
            [brandId]
        );

        const hierarchy = {
            ...brand[0],
            business_centers: businessCenters
        };

        res.json(hierarchy);

    } catch (error) {
        console.error('Error fetching brand hierarchy:', error);
        res.status(500).json({ message: 'Error fetching brand hierarchy' });
    } finally {
        if (conn) {
            conn.release();
        }
    }
};
