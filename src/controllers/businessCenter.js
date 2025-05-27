// src/controllers/businessCenter.js

import connectDB from '../db/index.js';  

// Create a new business
export const createBusiness = async (req, res) => {
    const connection = await connectDB.getConnection();
    try {
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
            other_detail
        } = req.body;

        if (!business_name) {
            return res.status(400).json({ message: 'Business name is required' });
        }

        await connection.beginTransaction();

        const [result] = await connection.query(
            `INSERT INTO business_center (
                business_name, business_phone, business_whatsapp, business_email,
                business_password, business_address, business_country, business_tax_id, business_reg_no,
                other_detail
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                business_name, business_phone, business_whatsapp, business_email,
                business_password, business_address, business_country, business_tax_id, business_reg_no,
                other_detail
            ]
        );

        await connection.commit();
        
        const [newBusiness] = await connection.query(
            'SELECT * FROM business_center WHERE id = ?',
            [result.insertId]
        );

        res.status(201).json({
            message: 'Business created successfully',
            business: newBusiness[0]
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error creating business:', error);
        res.status(500).json({ message: 'Error creating business' });
    } finally {
        connection.release();
    }
};

// Get all businesses
export const getAllBusinesses = async (req, res) => {
    const connection = await connectDB().getConnection();
    try {
        const [businesses] = await connection.query(
            'SELECT * FROM business_center ORDER BY created_at DESC'
        );
        res.json(businesses);
    } catch (error) {
        console.error('Error fetching businesses:', error);
        res.status(500).json({ message: 'Error fetching businesses' });
    } finally {
        connection.release();
    }
};

// Get a single business by ID
export const getBusinessById = async (req, res) => {
    const connection = await connectDB().getConnection();
    try {
        const [business] = await connection.query(
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
        connection.release();
    }
};

// Update a business
export const updateBusiness = async (req, res) => {
    const connection = await connectDB().getConnection();
    try {
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
            other_detail
        } = req.body;

        if (!business_name) {
            return res.status(400).json({ message: 'Business name is required' });
        }

        await connection.beginTransaction();

        const [result] = await connection.query(
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
                other_detail = ?
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
                req.params.id
            ]
        );

        await connection.commit();

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Business not found' });
        }

        const [updatedBusiness] = await connection.query(
            'SELECT * FROM business_center WHERE id = ?',
            [req.params.id]
        );

        res.json({
            message: 'Business updated successfully',
            business: updatedBusiness[0]
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error updating business:', error);
        res.status(500).json({ message: 'Error updating business' });
    } finally {
        connection.release();
    }
};

// Delete a business
export const deleteBusiness = async (req, res) => {
    const connection = await connectDB().getConnection();
    try {
        await connection.beginTransaction();

        const [result] = await connection.query(
            'DELETE FROM business_center WHERE id = ?',
            [req.params.id]
        );

        await connection.commit();

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Business not found' });
        }

        res.json({ message: 'Business deleted successfully' });
    } catch (error) {
        await connection.rollback();
        console.error('Error deleting business:', error);
        res.status(500).json({ message: 'Error deleting business' });
    } finally {
        connection.release();
    }
};
