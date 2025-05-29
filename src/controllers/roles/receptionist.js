// src/controllers/receptionist.js

import connectDB from '../../db/index.js';

// Create a new receptionist
export const createReceptionist = async (req, res) => {
    let conn;
    try {
        const pool = connectDB();
        conn = await pool.getConnection();

        const {
            receptionist_name,
            receptionist_phone,
            receptionist_email,
            rec_other_detail
        } = req.body;

        if (!receptionist_name) {
            return res.status(400).json({ message: 'Receptionist name is required' });
        }

        await conn.beginTransaction();

        const [result] = await conn.query(
            `INSERT INTO receptionist (
                receptionist_name, receptionist_phone, 
                receptionist_email, rec_other_detail
            ) VALUES (?, ?, ?, ?)`,
            [
                receptionist_name, receptionist_phone, 
                receptionist_email, rec_other_detail
            ]
        );

        await conn.commit();
        
        const [newReceptionist] = await conn.query(
            'SELECT * FROM receptionist WHERE id = ?',
            [result.insertId]
        );

        res.status(201).json({
            message: 'Receptionist created successfully',
            receptionist: newReceptionist[0]
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

// Get all receptionists
export const getAllReceptionists = async (req, res) => {
    let conn;
    try {
        const pool = connectDB();
        conn = await pool.getConnection();

        const [receptionists] = await conn.query(
            'SELECT * FROM receptionist ORDER BY created_at DESC'
        );

        res.json(receptionists);

    } catch (error) {
        console.error('Error fetching businesses:', error);
        res.status(500).json({ message: 'Error fetching businesses' });
    } finally {
        if (conn) {
            conn.release();
        }
    }
};

// Get receptionist by ID
export const getReceptionistById = async (req, res) => {
    let conn;
    try {
        const pool = connectDB();
        conn = await pool.getConnection();

        const [receptionist] = await conn.query(
            'SELECT * FROM receptionist WHERE id = ?',
            [req.params.id]
        );

        if (receptionist.length === 0) {
            return res.status(404).json({ message: 'Receptionist not found' });
        }

        res.json(receptionist[0]);

    } catch (error) {
        console.error('Error fetching receptionist:', error);
        res.status(500).json({ message: 'Error fetching receptionist' });
    } finally {
        if (conn) {
            conn.release();
        }
    }
};

// Update receptionist
export const updateReceptionist = async (req, res) => {
    let conn;
    try {
        const pool = connectDB();
        conn = await pool.getConnection();

        const {
            receptionist_name,
            receptionist_phone,
            receptionist_email,
            rec_other_detail
        } = req.body;

        await conn.beginTransaction();

        const [result] = await conn.query(
            `UPDATE receptionist SET
                receptionist_name = ?,
                receptionist_phone = ?,
                receptionist_email = ?,
                rec_other_detail = ?
            WHERE id = ?`,
            [
                receptionist_name,
                receptionist_phone,
                receptionist_email,
                rec_other_detail,
                req.params.id
            ]   
        );

        if (result.affectedRows === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Receptionist not found' });
        }

        await conn.commit();

        const [updatedReceptionist] = await conn.query(
            'SELECT * FROM receptionist WHERE id = ?',
            [req.params.id]
        );

        res.json({
            message: 'Receptionist updated successfully',
            receptionist: updatedReceptionist[0]
        });

    } catch (error) {
        if (conn) {
            await conn.rollback();
        }
        console.error('Error updating receptionist:', error);
        res.status(500).json({ message: 'Error updating receptionist' });
    } finally {
        if (conn) {
            conn.release();
        }
    }
};

// Delete receptionist
export const deleteReceptionist = async (req, res) => {
    let conn;
    try {
        const pool = connectDB();
        conn = await pool.getConnection();

        await conn.beginTransaction();

        const [result] = await conn.query(
            'DELETE FROM receptionist WHERE id = ?',
            [req.params.id]
        );

        if (result.affectedRows === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Receptionist not found' });
        }

        await conn.commit();

        res.json({ message: 'Receptionist deleted successfully' });

    } catch (error) {
        if (conn) {
            await conn.rollback();
        }
        console.error('Error deleting receptionist:', error);
        res.status(500).json({ message: 'Error deleting receptionist' });
    } finally {
        if (conn) {
            conn.release();
        }
    }
};


