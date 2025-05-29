// src/controllers/teams.js

import connectDB from '../db/index.js';

// Create a new team
export const createTeam = async (req, res) => {
    const { team_name, tax_id, reg_no, team_detail, team_address, team_country, team_prompt, team_phone, team_email } = req.body;
    const created_by = req.user.userId; // Get userId from auth middleware

    try {
        const pool = connectDB();
        const conn = await pool.getConnection();

        try {
            await conn.beginTransaction();

            // Convert spaces to underscores in team_name
            const formattedTeamName = team_name.replace(/\s+/g, '_');

            // Check if team already exists
            const [existingTeam] = await conn.query(
                'SELECT id FROM teams WHERE team_name = ?',
                [formattedTeamName]
            );

            if (existingTeam.length > 0) {
                await conn.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'Team already exists'
                });
            }

            // Create new team with formatted team name
            const [result] = await conn.query(
                'INSERT INTO teams (team_name, tax_id, reg_no, team_detail, team_address, team_country, team_prompt, team_phone, team_email, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [formattedTeamName, tax_id, reg_no, team_detail, team_address, team_country, team_prompt, team_phone, team_email, created_by]
            );

            await conn.commit();
            res.status(201).json({
                teams: [
                    {
                        message: 'Team created successfully',
                        team_id: result.insertId
                    }
                ]
            });

        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }

    } catch (error) {
        console.error('Error creating team:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get all teams
export const getAllTeams = async (req, res) => {
    const pool = connectDB();
    let connection;
    try {
        connection = await pool.getConnection();

        // Get all teams with creator information
        const [teams] = await connection.query(
            'SELECT t.*, a.username as created_by_name FROM teams t JOIN admin a ON t.created_by = a.id ORDER BY t.created_at DESC'
        );

        // Convert underscores back to spaces in team names
        const formattedTeams = teams.map(team => ({
            ...team,
            team_name: team.team_name.replace(/_/g, ' ')
        }));

        res.json({ teams: formattedTeams });

    } catch (error) {
        console.error('Error fetching teams:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

// Get teams by business ID
export const getTeamsByBusinessId = async (req, res) => {
    const pool = connectDB();
    let connection;
    try {
        connection = await pool.getConnection();
        const businessId = req.params.businessId;
        
        console.log('Fetching teams for business ID:', businessId);

        // First, let's check if any teams exist without joins
        const [rawTeams] = await connection.query(
            'SELECT * FROM teams WHERE business_center_id = ?',
            [businessId]
        );
        console.log('Raw teams found:', rawTeams);

        // Then do the full query with joins
        const [teams] = await connection.query(
            `SELECT t.*, a.username as created_by_name 
             FROM teams t 
             LEFT JOIN admin a ON t.created_by = a.id 
             WHERE t.business_center_id = ?
             ORDER BY t.created_at DESC`,
            [businessId]
        );

        console.log('Teams after join:', teams);

        // Convert underscores back to spaces in team names
        const formattedTeams = teams.map(team => ({
            ...team,
            team_name: team.team_name.replace(/_/g, ' ')
        }));

        console.log('Formatted teams:', formattedTeams);
        console.log('User from token:', req.user);

        res.json({ teams: formattedTeams });

    } catch (error) {
        console.error('Error fetching teams:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};
