// src/controllers/schedule.js

import connectDB from '../db/index.js';  

// Function to get reminders based on upcoming call times
export const getReminders = async (req, res) => {
    let connection;
    try {
        const pool = await connectDB();
        connection = await pool.getConnection();

        // Check if user exists in request
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const username = req.user.username;

        // Get user's team info
        const [userInfo] = await connection.execute(`
            SELECT tm.id as user_id, tm.team_id
            FROM team_members tm
            WHERE tm.username = ?
        `, [username]);

        if (!userInfo.length) {
            return res.status(404).json({ message: 'User  not found' });
        }

        const teamId = userInfo[0].team_id;
        const userId = userInfo[0].user_id;

        let sql;
        const params = [];

        // Define time thresholds for reminders (15 mins, 5 mins, 1 min)
        const timeCondition = `
            s.scheduled_at IS NOT NULL
            AND s.scheduled_at > NOW()
            AND (
                TIMESTAMPDIFF(MINUTE, NOW(), s.scheduled_at) <= 15
                OR TIMESTAMPDIFF(MINUTE, NOW(), s.scheduled_at) <= 5
                OR TIMESTAMPDIFF(MINUTE, NOW(), s.scheduled_at) <= 1
            )
        `;

        // Base fields to select
        const baseFields = `
            s.*, c.*, 
            TIMESTAMPDIFF(MINUTE, NOW(), s.scheduled_at) as minutes_until_call
        `;

        // All users can see reminders they created or are assigned to them
        sql = `
            SELECT ${baseFields}
            FROM scheduler s
            JOIN customers c ON c.id = s.customer_id
            WHERE (
                s.created_by = ? -- reminders they created
                OR s.created_by = ? -- reminders assigned to them (assuming created_by is used for this)
            )
            AND ${timeCondition}
            AND s.status = 'pending'
            ORDER BY s.scheduled_at ASC
        `;
        params.push(userId, username);

        const [rows] = await connection.execute(sql, params);

        // Process reminders to add priority based on time
        const processedRows = rows.map(row => {
            const minutesUntil = row.minutes_until_call;
            let priority;

            if (minutesUntil <= 1) {
                priority = 'high';
            } else if (minutesUntil <= 5) {
                priority = 'high';
            } else if (minutesUntil <= 15) {
                priority = 'medium';
            } else {
                priority = 'low';
            }

            return {
                ...row,
                priority
            };
        });

        res.status(200).json(processedRows);
    } catch (error) {
        console.error('Error fetching reminders:', error);
        res.status(500).json({ message: 'Failed to fetch reminders', error: error.message });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

// Function to get all reminders for a user
export const getAllReminders = async (req, res) => {
    let connection;
    try {
        const pool = await connectDB();
        connection = await pool.getConnection();

        // Check if user exists in request
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const username = req.user.username;

        // Get user's team info
        const [userInfo] = await connection.execute(`
            SELECT tm.id as user_id, tm.team_id
            FROM team_members tm
            WHERE tm.username = ?
        `, [username]);

        if (!userInfo.length) {
            return res.status(404).json({ message: 'User  not found' });
        }

        const teamId = userInfo[0].team_id;
        const userId = userInfo[0].user_id;

        let sql;
        const params = [];

        // Base fields to select
        const baseFields = `
            s.*, c.*, 
            TIMESTAMPDIFF(MINUTE, NOW(), s.scheduled_at) as minutes_until_call
        `;

        // Define time condition for future reminders
        const timeCondition = `
            s.scheduled_at IS NOT NULL
            AND s.scheduled_at > NOW()
        `;

        // All users can see reminders they created or are assigned to them
        sql = `
            SELECT ${baseFields}
            FROM scheduler s
            JOIN customers c ON c.id = s.customer_id
            WHERE (
                s.created_by = ? -- reminders they created
                OR s.created_by = ? -- reminders assigned to them (assuming created_by is used for this)
            )
            AND ${timeCondition}
            AND s.status = 'pending'
            ORDER BY s.scheduled_at ASC
        `;
        params.push(userId, username);

        const [rows] = await connection.execute(sql, params);

        // Process reminders to categorize by time threshold
        const processedRows = rows.map(row => {
            const minutesUntil = row.minutes_until_call;
            let reminderType;
            let priority;

            if (minutesUntil <= 1) {
                reminderType = '1_minute';
                priority = 'critical';
            } else if (minutesUntil <= 5) {
                reminderType = '5_minutes';
                priority = 'high';
            } else if (minutesUntil <= 15) {
                reminderType = '15_minutes';
                priority = 'medium';
            } else {
                reminderType = 'upcoming';
                priority = 'low';
            }

            return {
                ...row,
                reminderType,
                priority
            };
        });

        res.status(200).json(processedRows);
    } catch (error) {
        console.error('Error fetching all reminders:', error);
        res.status(500).json({ message: 'Failed to fetch all reminders', error: error.message });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

// Function to get scheduled records with customer and assignment info
export const getScheduleRecords = async (req, res) => {
  try {
    const connection = await connectDB();
    const query = `
      SELECT 
        c.customer_name, 
        s.scheduled_at
      FROM scheduler s
      JOIN customers c ON s.customer_id = c.id
      ORDER BY s.scheduled_at DESC, s.id DESC
    `;
    const [records] = await connection.query(query);

    // Check if request body is empty
    const hasBody = req.body && Object.keys(req.body).length > 0;
    
    // If no body, return records directly
    if (!hasBody) {
      return res.status(200).json({
        success: true,
        count: records.length,
        data: records
      });
    }

    // Allow remapping field names if requested
    const {
      customer_name = "customer_name",
      scheduled_at = "scheduled_at"
    } = req.body;

    const mappedRecords = records.map(record => ({
      [customer_name]: record.customer_name,
      [scheduled_at]: record.scheduled_at
    }));

    return res.status(200).json({
      success: true,
      count: mappedRecords.length,
      data: mappedRecords
    });

  } catch (error) {
    console.error("Error in getScheduleRecords:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
