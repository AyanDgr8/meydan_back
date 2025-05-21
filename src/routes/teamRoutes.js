// src/routes/teamRoutes.js

import express from 'express';
import { createTeam, getAllTeams } from '../controllers/teams.js';
import { createUser, getAllUsers } from '../controllers/users.js';
import { authenticateToken } from '../middlewares/auth.js';
import connectDB from '../db/index.js';

const router = express.Router();

// Team routes
router.post('/players/teams', authenticateToken, createTeam);
router.get('/players/teams', authenticateToken, getAllTeams);

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
            message: 'Failed to fetch team customers',
            error: err.message 
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// User management routes
router.post('/players/users', authenticateToken, createUser);
router.get('/players/users', authenticateToken, getAllUsers);

export default router;
