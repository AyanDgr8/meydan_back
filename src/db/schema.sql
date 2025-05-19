-- src/db/schema.sql

-- 1. Create permissions
CREATE TABLE IF NOT EXISTS permissions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    permission_name VARCHAR(50) NOT NULL UNIQUE
);

-- 2. Create roles
CREATE TABLE IF NOT EXISTS roles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    role_name ENUM('super_admin', 'it_admin', 'business_head', 'team_leader', 'user') NOT NULL
);

-- 3. Create teams (temporarily without the foreign key to users)
CREATE TABLE IF NOT EXISTS teams (
    id INT PRIMARY KEY AUTO_INCREMENT,
    team_name VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INT NOT NULL
    -- FOREIGN KEY (created_by) REFERENCES users(id)  -- Add this later
);

-- 4. Create users
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(20) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    team_id INT,
    role_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id),
    FOREIGN KEY (role_id) REFERENCES roles(id)
);


ALTER TABLE users ADD UNIQUE (username);



-- 5. Alter teams table to add foreign key now that users table exists
ALTER TABLE teams
ADD CONSTRAINT fk_created_by FOREIGN KEY (created_by) REFERENCES users(id);

-- 6. Create user_permissions
CREATE TABLE IF NOT EXISTS user_permissions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    permission_id INT NOT NULL,
    value BOOLEAN DEFAULT false,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (permission_id) REFERENCES permissions(id),
    UNIQUE KEY unique_user_permission (user_id, permission_id)
);

-- Insert default roles
INSERT INTO roles (role_name) VALUES 
('super_admin'),
('it_admin'),
('business_head'),
('team_leader'),
('user');


-- Insert default permissions
INSERT INTO permissions (permission_name) VALUES 
('create_customer'),      -- Create Record
('edit_customer'),        -- Edit Record
('delete_customer'),      -- Delete Data
('view_customer'),        -- View All Data
('view_team_customers'), -- View Team Data
('view_assigned_customers'), -- View Own Data
('upload_document'),     -- Upload Document
('download_data');       -- Download Data



The following means :
('upload_document'), can upload the document
('download_data'), can download the document 
('create_customer'), can create a new record 
('edit_customer'), can edit the record 
('delete_customer'), can delete a record 
('view_customer'), can view all customers of the team
('view_team_customers'), can view all customers assigned to him

instead of being unique usernames just interlink the agent_name 

-- 7. Create login_history
CREATE TABLE `login_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `device_id` varchar(255) NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `login_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `logout_time` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `login_history_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
ALTER TABLE login_history ADD COLUMN last_activity timestamp NULL DEFAULT CURRENT_TIMESTAMP;

-- 8. Create customer_field_values table
CREATE TABLE IF NOT EXISTS customer_field_values (
    id INT PRIMARY KEY AUTO_INCREMENT,
    field_name VARCHAR(50) NOT NULL,
    field_value VARCHAR(100) NOT NULL,
    UNIQUE KEY unique_field_value (field_name, field_value)
);

-- 9. Create customers
CREATE TABLE `customers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `first_name` varchar(100) DEFAULT NULL,
  `middle_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(100) DEFAULT NULL,
  `phone_no_primary` varchar(15) DEFAULT NULL,
  `whatsapp_num` varchar(15) DEFAULT NULL,
  `phone_no_secondary` varchar(15) DEFAULT NULL,
  `email_id` varchar(100) DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL,
  `gender` varchar(20) DEFAULT 'male',
  `address` text,
  `country` varchar(15) DEFAULT NULL,
  `company_name` varchar(100) DEFAULT NULL,
  `designation` varchar(100) DEFAULT NULL,
  `website` varchar(100) DEFAULT NULL,
  `other_location` varchar(255) DEFAULT NULL,
  `contact_type` varchar(50) DEFAULT NULL,
  `source` varchar(100) DEFAULT NULL,
  `disposition` varchar(50) DEFAULT 'interested',
  `agent_name` varchar(100) DEFAULT NULL,
  `comment` varchar(255) DEFAULT NULL,
  `scheduled_at` datetime DEFAULT NULL,
  `date_created` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `C_unique_id` varchar(10) DEFAULT NULL,
  `last_updated` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `C_unique_id` (`C_unique_id`)
);
ALTER TABLE customers ADD COLUMN QUEUE_NAME varchar(50) DEFAULT NULL AFTER disposition;


-- Insert default values for gender
INSERT INTO customer_field_values (field_name, field_value) VALUES 
('gender', 'male'),
('gender', 'female'),
('gender', 'other');

-- Insert default values for disposition
INSERT INTO customer_field_values (field_name, field_value) VALUES 
('disposition', 'interested'),
('disposition', 'not interested'),
('disposition', 'needs to call back'),
('disposition', 'switched off'),
('disposition', 'ringing no response'),
('disposition', 'follow-up'),
('disposition', 'invalid number'),
('disposition', 'whatsapp number'),
('disposition', 'converted'),
('disposition', 'referral');

-- 10. Create updates_customer
CREATE TABLE `updates_customer` (
  `id` int NOT NULL AUTO_INCREMENT,
  `customer_id` int NOT NULL,
  `C_unique_id` varchar(10) NOT NULL,
  `field` varchar(255) NOT NULL,
  `old_value` text,
  `new_value` text,
  `changed_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `phone_no_primary` varchar(15) DEFAULT NULL,
  `changed_by` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `customer_id` (`customer_id`),
  CONSTRAINT `updates_customer_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`)
) ;

-- Create scheduler table
CREATE TABLE `scheduler` (
  `id` int NOT NULL AUTO_INCREMENT,
  `customer_id` int NOT NULL,
  `scheduled_at` datetime NOT NULL,
  `created_by` int NOT NULL,  -- user_id who created the reminder
  `assigned_to` varchar(100) NOT NULL,  -- username of agent assigned to
  `description` text,
  `status` ENUM('pending', 'completed', 'cancelled') DEFAULT 'pending',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `customer_id` (`customer_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `scheduler_customer_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `scheduler_user_fk` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
);

-- Migrate existing reminders from customers table to scheduler
INSERT INTO scheduler (customer_id, scheduled_at, created_by, assigned_to)
SELECT 
    c.id as customer_id,
    c.scheduled_at,
    u.id as created_by,
    c.agent_name as assigned_to
FROM customers c
JOIN users u ON u.username = c.agent_name
WHERE c.scheduled_at IS NOT NULL;

********************
DELIMITER //

DROP TRIGGER IF EXISTS after_customers_scheduled_at_update//

CREATE TRIGGER after_customers_scheduled_at_update 
AFTER UPDATE ON customers 
FOR EACH ROW 
BEGIN
    DECLARE agent_id INT;
    DECLARE existing_id INT;
    
    -- Only create scheduler entry if scheduled_at is changed to a non-null value
    IF NEW.scheduled_at IS NOT NULL AND 
       (OLD.scheduled_at IS NULL OR NEW.scheduled_at <> OLD.scheduled_at) THEN 
        
        -- Try to find the user ID for the agent_name
        -- This ensures we have a valid user ID for the created_by field
        SELECT id INTO agent_id FROM users WHERE username = NEW.agent_name LIMIT 1;
        
        -- If we can't find the agent, use the first admin user as a fallback
        IF agent_id IS NULL THEN
            SELECT id INTO agent_id FROM users WHERE role_id = 1 LIMIT 1; -- Assuming role_id 1 is admin
        END IF;
        
        -- Check if there's an existing pending scheduler entry for this customer
        SELECT id INTO existing_id FROM scheduler 
        WHERE customer_id = NEW.id AND status = 'pending' LIMIT 1;
        
        IF existing_id IS NOT NULL THEN
            -- Update existing scheduler entry
            UPDATE scheduler SET
                scheduled_at = NEW.scheduled_at,
                updated_at = NOW()
            WHERE id = existing_id;
        ELSE
            -- Create new scheduler entry
            INSERT INTO scheduler (
                customer_id,
                scheduled_at,
                created_by,
                assigned_to,
                description,
                status
            ) VALUES (
                NEW.id,
                NEW.scheduled_at,
                agent_id,           -- Use the agent's ID or admin ID as fallback
                NEW.agent_name,     -- The agent to whom it is assigned
                CONCAT('Scheduled call with ', NEW.first_name, ' ', IFNULL(NEW.last_name, '')),
                'pending'
            );
        END IF;
    END IF;
END//

DELIMITER ;