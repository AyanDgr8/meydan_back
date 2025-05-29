// src/controllers/teams.js

import connectDB from '../db/index.js';

// Create a new team
export const createTeam = async (req, res) => {
    const { team_name, tax_id, reg_no, team_detail, team_address, team_country, team_prompt, team_phone, team_email, business_center_id } = req.body;
    const created_by = req.user.userId; // Get userId from auth middleware
    
    console.log('User object:', req.user); // Add logging to see user object
    console.log('Brand ID from user:', req.user.brand_id); // Add specific brand_id logging

    try {
        const pool = connectDB();
        const conn = await pool.getConnection();

        try {
            await conn.beginTransaction();

            // Convert spaces to underscores in team_name
            const formattedTeamName = team_name.replace(/\s+/g, '_');

            // Check if team already exists for this brand
            const [existingTeam] = await conn.query(
                'SELECT id FROM teams WHERE team_name = ? AND (brand_id = ? OR business_center_id IN (SELECT id FROM business_center WHERE brand_id = ?))',
                [formattedTeamName, req.user.brand_id, req.user.brand_id]
            );

            if (existingTeam.length > 0) {
                await conn.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'Team already exists for this brand'
                });
            }

            // If business_center_id is provided, verify it belongs to the user's brand
            if (business_center_id) {
                const [businessCenter] = await conn.query(
                    'SELECT brand_id FROM business_center WHERE id = ? AND brand_id = ?',
                    [business_center_id, req.user.brand_id]
                );
                
                if (businessCenter.length === 0) {
                    await conn.rollback();
                    return res.status(400).json({
                        success: false,
                        message: 'Business center does not belong to your brand'
                    });
                }
            }

            // Create new team with formatted team name
            const insertQuery = `
                INSERT INTO teams (
                    team_name, tax_id, reg_no, team_detail, team_address, 
                    team_country, team_prompt, team_phone, team_email, 
                    team_type, created_by, brand_id, business_center_id
                ) VALUES (
                    ?, ?, ?, ?, ?, 
                    ?, ?, ?, ?, 
                    ?, ?, ?, ?
                )`;
            
            const insertParams = [
                formattedTeamName, tax_id, reg_no, team_detail, team_address,
                team_country, team_prompt, team_phone, team_email,
                'company', created_by, req.user.brand_id, business_center_id || null
            ];

            console.log('Creating team with params:', {
                user_brand_id: req.user.brand_id,
                business_center_id: business_center_id || null,
                team_name: formattedTeamName
            });

            try {
                const [result] = await conn.query(insertQuery, insertParams);
                console.log('Insert succeeded:', result);

                // Verify the insert by selecting the created team with its relationships
                const [verifyTeam] = await conn.query(
                    `SELECT t.*, 
                            bc.business_name as business_center_name,
                            b.brand_name
                     FROM teams t 
                     LEFT JOIN business_center bc ON t.business_center_id = bc.id
                     LEFT JOIN brand b ON t.brand_id = b.id
                     WHERE t.id = ?`,
                    [result.insertId]
                );

                if (!verifyTeam[0].brand_id) {
                    console.error('Team created but brand_id is null:', verifyTeam[0]);
                    await conn.rollback();
                    throw new Error('Failed to save brand_id');
                }

                console.log('Verification of inserted team:', verifyTeam[0]);

                await conn.commit();
                res.status(201).json({
                    success: true,
                    teams: [{
                        message: 'Team created successfully',
                        team_id: result.insertId,
                        team_details: verifyTeam[0]
                    }]
                });
            } catch (error) {
                console.error('Error creating team:', error);
                await conn.rollback();
                res.status(500).json({
                    success: false,
                    message: 'Failed to create team',
                    error: error.message
                });
            }

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
        const user = req.user;
        
        console.log('Getting all teams, user:', user);

        // If user role is not in req.user, try to get it from decoded token
        const userRole = user.role || (req.decodedToken ? req.decodedToken.role : null);
        console.log('User role:', userRole);

        let query;
        let params = [];

        if (userRole === 'brand_user') {
            // For brand users, get teams by brand_id
            const brandId = req.decodedToken?.brand_id || user.brand_id;
            console.log('Using brand_id for query:', brandId);
            
            query = `SELECT t.*, a.username as created_by_name 
                    FROM teams t 
                    LEFT JOIN admin a ON t.created_by = a.id 
                    WHERE t.brand_id = ?
                    ORDER BY t.created_at DESC`;
            params = [brandId];
        } else if (userRole === 'admin') {
            // For admin users, get all teams
            query = `SELECT t.*, a.username as created_by_name 
                    FROM teams t 
                    LEFT JOIN admin a ON t.created_by = a.id 
                    ORDER BY t.created_at DESC`;
        } else {
            // For other users, get teams by business_center_id
            const businessCenterId = user.business_center_id;
            query = `SELECT t.*, a.username as created_by_name 
                    FROM teams t 
                    LEFT JOIN admin a ON t.created_by = a.id 
                    WHERE t.business_center_id = ?
                    ORDER BY t.created_at DESC`;
            params = [businessCenterId];
        }

        // Execute the query
        const [teams] = await connection.query(query, params);
        console.log('Teams found:', teams);

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
        const user = req.user;
        
        console.log('Fetching teams for business ID:', businessId);
        console.log('Full user object:', user);

        // If user role is not in req.user, try to get it from decoded token
        const userRole = user.role || (req.decodedToken ? req.decodedToken.role : null);
        console.log('User role:', userRole);

        let query;
        let params = [];

        if (userRole === 'brand_user') {
            // For brand users, get teams by brand_id and business_center_id
            const brandId = req.decodedToken?.brand_id || user.brand_id;
            console.log('Using brand_id for query:', brandId);
            
            query = `
                SELECT t.*, 
                       a.username as created_by_name,
                       bc.business_name as business_center_name,
                       bc.business_address as business_center_address,
                       bc.business_phone as business_center_phone,
                       bc.business_email as business_center_email
                FROM teams t 
                LEFT JOIN admin a ON t.created_by = a.id 
                LEFT JOIN business_center bc ON t.business_center_id = bc.id
                WHERE t.brand_id = ? AND t.business_center_id = ?
                ORDER BY t.created_at DESC`;
            params = [brandId, businessId];
        } else if (userRole === 'admin') {
            // For admin users, get teams for specific business center
            query = `
                SELECT t.*, 
                       a.username as created_by_name,
                       bc.business_name as business_center_name,
                       bc.business_address as business_center_address,
                       bc.business_phone as business_center_phone,
                       bc.business_email as business_center_email
                FROM teams t 
                LEFT JOIN admin a ON t.created_by = a.id 
                LEFT JOIN business_center bc ON t.business_center_id = bc.id
                WHERE t.business_center_id = ?
                ORDER BY t.created_at DESC`;
            params = [businessId];
        } else {
            return res.status(403).json({ 
                success: false,
                message: 'Unauthorized access' 
            });
        }

        // Execute query first
        const [teams] = await connection.query(query, params);
        console.log('Teams after join:', teams);

        // Then format the results
        const formattedTeams = teams.map(team => ({
            ...team,
            team_name: team.team_name.replace(/_/g, ' ')
        }));

        console.log('Formatted teams:', formattedTeams);
        res.json({ teams: formattedTeams });

    } catch (error) {
        console.error('Error fetching teams:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching teams',
            error: error.message 
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

// Get team by name
export const getTeamByName = async (req, res) => {
    const pool = connectDB();
    let connection;
    try {
        connection = await pool.getConnection();
        const teamName = req.params.teamName;
        const user = req.user;
        
        console.log('Fetching team by name:', teamName);
        console.log('Full user object:', user);

        // Convert spaces to underscores in team name for DB query
        const formattedTeamName = teamName.replace(/\s+/g, '_');

        // If user role is not in req.user, try to get it from decoded token
        const userRole = user.role || (req.decodedToken ? req.decodedToken.role : null);
        console.log('User role:', userRole);

        let query;
        let params;

        if (userRole === 'brand_user') {
            // For brand users, get team that matches the name and brand_id
            const brandId = req.decodedToken?.brand_id || user.brand_id;
            console.log('Using brand_id for query:', brandId);
            
            query = `
                SELECT 
                    t.*,
                    a.username as created_by_name,
                    bc.id as business_center_id,
                    bc.business_name as business_center_name,
                    bc.business_address as business_center_address,
                    bc.business_phone as business_center_phone,
                    bc.business_email as business_center_email
                FROM teams t
                LEFT JOIN business_center bc ON t.business_center_id = bc.id
                LEFT JOIN admin a ON t.created_by = a.id
                WHERE t.team_name = ? 
                AND bc.brand_id = ?
                ORDER BY t.created_at DESC`;
            params = [formattedTeamName, brandId];
        } else {
            // For other users, get team by name with business center info
            query = `
                SELECT 
                    t.*,
                    a.username as created_by_name,
                    bc.id as business_center_id,
                    bc.business_name as business_center_name,
                    bc.business_address as business_center_address,
                    bc.business_phone as business_center_phone,
                    bc.business_email as business_center_email
                FROM teams t 
                LEFT JOIN admin a ON t.created_by = a.id
                LEFT JOIN business_center bc ON t.business_center_id = bc.id
                WHERE t.team_name = ?
                ORDER BY t.created_at DESC`;
            params = [formattedTeamName];
        }

        console.log('Executing query:', query, 'with params:', params);

        // First, let's check if the team exists
        const [teams] = await connection.query(query, params);
        
        if (teams.length === 0) {
            // If no team found, return available teams for the brand/business center
            let availableTeamsQuery;
            let availableTeamsParams;

            if (userRole === 'brand_user') {
                availableTeamsQuery = `
                    SELECT DISTINCT t.team_name 
                    FROM teams t 
                    JOIN business_center bc ON t.business_center_id = bc.id 
                    WHERE bc.brand_id = ?`;
                availableTeamsParams = [brandId];
            } else {
                availableTeamsQuery = `SELECT DISTINCT team_name FROM teams`;
                availableTeamsParams = [];
            }

            const [availableTeams] = await connection.query(availableTeamsQuery, availableTeamsParams);
            return res.status(404).json({ 
                success: false,
                message: `Team "${teamName}" not found. Available teams: ${availableTeams.map(t => t.team_name.replace(/_/g, ' ')).join(', ')}` 
            });
        }

        // Format the response to include both team and business center info
        const team = teams[0];
        const response = {
            team: {
                ...team,
                team_name: team.team_name.replace(/_/g, ' ')
            },
            business_center: {
                id: team.business_center_id,
                name: team.business_center_name,
                address: team.business_center_address,
                phone: team.business_center_phone,
                email: team.business_center_email
            }
        };

        console.log('Formatted response:', response);
        res.json(response);

    } catch (error) {
        console.error('Error fetching team:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};
