// src/routes/teamRoutes.js

import express from 'express';
import { createTeam, getAllTeams, getTeamByName } from '../controllers/teams.js';
import { createUser, getAllUsers } from '../controllers/users.js';
import { authenticateToken } from '../middlewares/auth.js';
import connectDB from '../db/index.js';

const router = express.Router();

// Team routes
router.post('/players/teams', authenticateToken, createTeam);
router.get('/players/teams', authenticateToken, getAllTeams);

// Get team by name (new route)
router.get('/business/:teamName', authenticateToken, getTeamByName);

// New endpoint for fetching team-specific customer records
router.get('/:teamName', authenticateToken, async (req, res) => {
    const pool = await connectDB();
    let connection;
    try {
        connection = await pool.getConnection();
        const { teamName } = req.params;
        
        const [rows] = await connection.execute(
            `SELECT c.*, tm.username as agent_name 
             FROM customers c 
             LEFT JOIN team_members tm ON c.agent_name = tm.username
             WHERE c.queue_name = ? 
             ORDER BY IFNULL(c.last_updated, '1970-01-01') DESC`,
            [teamName]
        );

        res.json(rows);
    } catch (err) {
        console.error('Error fetching team customers:', err);
        res.status(500).json({ 
            success: false,
            message: 'Failed to fetch team customers',
            error: err.message 
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// Get customer by phone number for a specific team
router.get('/:teamName/:phone_no', authenticateToken, async (req, res) => {

    try {
        const pool = await connectDB();
        const connection = await pool.getConnection();

        try {
            const { teamName, phone_no } = req.params;

            const [customers] = await connection.query(
                `SELECT c.* 
                 FROM customers c
                 LEFT JOIN teams t ON c.team_id = t.id
                 WHERE t.team_name = ? AND c.phone_no_primary = ?`,
                [teamName, phone_no]
            );

            if (customers.length === 0) {
                return res.json({
                    success: true,
                    exists: false,
                    message: 'Customer not found',
                    redirect: `/customers/create?team=${teamName}`
                });
            }

            res.json({
                success: true,
                exists: true,
                customer: customers[0]
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error fetching customer:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// User management routes
router.post('/players/users', authenticateToken, createUser);
router.get('/players/users', authenticateToken, getAllUsers);

export default router;
