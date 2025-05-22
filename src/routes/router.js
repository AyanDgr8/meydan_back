// src/routes/router.js

import express from 'express';
import teamRoutes from './teamRoutes.js';

import {
    searchCustomers,
    getAllCustomers,
    assignCustomerToTeam,
    checkDuplicates,
    getTeamRecords,
    getCustomersByDateRange
} from '../controllers/customers.js';

import { deleteCustomer, deleteMultipleCustomers } from '../controllers/deleteCustomers.js';

import { makeNewRecord, createCustomer } from '../controllers/createCustomers.js';

import { updateCustomer, historyCustomer, gethistoryCustomer } from '../controllers/updateCustomers.js';

import { 
    loginAdmin,
    logoutAdmin, 
    fetchCurrentAdmin, forgotPassword, 
    resetPasswordWithToken, resetPassword,
    sendOTP , checkSession 
} from '../controllers/sign.js';

import { getReminders, getAllReminders, getScheduleRecords } from '../controllers/schedule.js';
import { getAllTeams } from '../controllers/teams.js';

// import { uploadCustomerData, confirmUpload } from '../controllers/uploadFile.js';
import { downloadCustomerData, getQueueNames } from '../controllers/downloadFile.js';
import { authenticateToken } from '../middlewares/auth.js';
import { checkCustomerByPhone } from '../controllers/newnum.js';

import { validateSession } from '../middlewares/sessionMiddleware.js';

import { createUser, getAllUsers, getTeamMembers } from '../controllers/users.js';

const router = express.Router();

// Mount team routes
router.use('/team', teamRoutes);

// Route for user login
router.post('/login', loginAdmin);

// Route for sending OTP (reset password link)
router.post('/send-otp', sendOTP);

// Route for resetting password with token
router.post('/reset-password/:id/:token', resetPasswordWithToken);

// Route for forgot password
router.post('/forgot-password', forgotPassword);

// Route for resetting password with token
router.post('/reset-password/:token', resetPassword);

// Route for user logout
router.post('/logout', authenticateToken, logoutAdmin);

// Route to check session
router.get('/check-session', validateSession, checkSession);
router.get('/current-user', authenticateToken, fetchCurrentAdmin);

// Team and user management routes
router.post('/users/create', authenticateToken, createUser);
router.get('/users/all', authenticateToken, getAllUsers);
router.get('/players/users', authenticateToken, getAllUsers);
router.get('/players/teams', authenticateToken, getAllTeams);
router.get('/users/team/:teamId', authenticateToken, getTeamMembers);

// User routes
router.get('/current-queue', authenticateToken, async (req, res) => {
  try {
    // User information is already attached to req by authenticateToken middleware
    const { username, QUEUE_NAME, role } = req.user;
    res.json({ username, QUEUE_NAME, role });
  } catch (error) {
    console.error('Error fetching queue info:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Customer routes
router.get('/customers', authenticateToken, getAllCustomers);
router.get('/customers/search', authenticateToken, searchCustomers);
router.get('/customers/team', authenticateToken, getAllCustomers);
router.get('/customers/assigned', authenticateToken, getAllCustomers);

// Customer CRUD operations
router.post('/customers/create', authenticateToken, createCustomer);
router.put('/customers/:id', authenticateToken, updateCustomer);
router.delete('/customers/:id', authenticateToken, deleteCustomer);
router.post('/customers/delete-multiple', authenticateToken, deleteMultipleCustomers);

// Customer phone number operations
router.get('/team/:teamName/:phone_no', authenticateToken, checkCustomerByPhone);
router.patch('/customers/phone/:phone_no/updates', authenticateToken, updateCustomer);
router.post('/customers/create/:phone_no', authenticateToken, makeNewRecord);

// Customer history
router.get('/customers/log-change/:id', authenticateToken, gethistoryCustomer);
router.post('/customers/log-change', authenticateToken, historyCustomer);

// Customer reminders
router.get('/customers/reminders', authenticateToken, getReminders);
router.get('/customers/getAllReminders', authenticateToken, getAllReminders);

// Route to assign customers to team/agent
router.post('/customers/assign-team', authenticateToken, assignCustomerToTeam);

// Download routes
router.get('/download/queues', authenticateToken, getQueueNames);
router.get('/download/customers', authenticateToken, downloadCustomerData);

// Route to get customers by date range
router.get('/customers/date-range', authenticateToken, getCustomersByDateRange);

// Route to check duplicates
router.post('/customers/check-duplicates', authenticateToken, checkDuplicates);

// Route to get team records with field mapping
router.post('/records_info', getTeamRecords);

// Route to get schedule records with field mapping
router.post('/records_schedule', getScheduleRecords);

export default router;
