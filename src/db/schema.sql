-- src/db/schema.sql

-- Create admin table (single user)
CREATE TABLE IF NOT EXISTS admin (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Brand table (must be created first due to foreign key references)
CREATE TABLE IF NOT EXISTS brand (
    id INT AUTO_INCREMENT PRIMARY KEY,
    brand_name VARCHAR(100) NOT NULL,
    brand_phone VARCHAR(15),
    brand_email VARCHAR(100) UNIQUE,
    brand_password VARCHAR(255),
    brand_email_password VARCHAR(255),
    brand_person VARCHAR(100),
    centers INT,
    companies INT,
    associates INT,
    receptionist INT,
    brand_tax_id VARCHAR(50),
    brand_reg_no VARCHAR(50),
    brand_other_detail TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create business_center table
CREATE TABLE IF NOT EXISTS business_center (
    id INT AUTO_INCREMENT PRIMARY KEY,
    business_name VARCHAR(100) NOT NULL,
    business_phone VARCHAR(15),
    business_whatsapp VARCHAR(15),
    business_email VARCHAR(100),
    business_password VARCHAR(255),
    business_person VARCHAR(100),
    business_address TEXT,
    business_country VARCHAR(50),
    business_tax_id VARCHAR(50),
    business_reg_no VARCHAR(50),
    other_detail TEXT,
    brand_id INT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (brand_id) REFERENCES brand(id) ON DELETE CASCADE
);

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    role_name ENUM('admin', 'brand_user', 'receptionist') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_role_name (role_name)
);




-- Insert default roles
INSERT INTO roles (role_name) VALUES 
    ('admin'),
    ('brand_user'),
    ('business_admin'),
    ('receptionist');


-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role_id INT NOT NULL,
    brand_id INT DEFAULT NULL,
    business_center_id INT DEFAULT NULL,
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id),
    FOREIGN KEY (brand_id) REFERENCES brand(id) ON DELETE SET NULL,
    FOREIGN KEY (business_center_id) REFERENCES business_center(id) ON DELETE SET NULL
);




-- Create trigger to handle user creation from brand
DELIMITER $$

DROP TRIGGER IF EXISTS after_brand_insert$$

CREATE TRIGGER after_brand_insert
AFTER INSERT ON brand
FOR EACH ROW
BEGIN
    -- Create user account for brand user with hashed password
    INSERT INTO users (
        username,
        email,
        password,
        role_id,
        brand_id
    )
    SELECT 
        NEW.brand_name,
        NEW.brand_email,
        NEW.brand_password, -- Password will be hashed in the controller
        r.id,
        NEW.id
    FROM roles r
    WHERE r.role_name = 'brand_user';
END$$

DELIMITER ;

-- Create teams
CREATE TABLE IF NOT EXISTS teams (
    id INT PRIMARY KEY AUTO_INCREMENT,
    team_name VARCHAR(50) NOT NULL,
    tax_id VARCHAR(50) DEFAULT NULL,
    reg_no VARCHAR(50) DEFAULT NULL,
    team_detail TEXT DEFAULT NULL,
    team_address text DEFAULT NULL,
    team_country varchar(50) DEFAULT NULL,
    team_prompt VARCHAR(500) DEFAULT NULL,
    team_phone VARCHAR(15) DEFAULT NULL,
    team_email VARCHAR(100) DEFAULT NULL,
    team_type ENUM('company', 'department') NOT NULL DEFAULT 'company',
    business_center_id INT NOT NULL,
    brand_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INT NOT NULL,
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (business_center_id) REFERENCES business_center(id) ON DELETE CASCADE,
    FOREIGN KEY (brand_id) REFERENCES brand(id) ON DELETE CASCADE,
    UNIQUE KEY unique_team_business (team_name, business_center_id),
    UNIQUE KEY unique_team_brand (team_name, brand_id)
);

-- Create team_members (users)
CREATE TABLE IF NOT EXISTS team_members (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL,
    department VARCHAR(100) DEFAULT NULL,
    email VARCHAR(100) NOT NULL,
    mobile_num VARCHAR(15) NOT NULL,
    mobile_num_2 VARCHAR(15) DEFAULT NULL,
    designation VARCHAR(30) DEFAULT NULL,
    team_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    UNIQUE KEY unique_username_team (username, team_id),
    UNIQUE KEY unique_team_email (team_id, email),
    UNIQUE KEY unique_team_mobile (team_id, mobile_num)
);

alter table team_members add column extension VARCHAR(20) DEFAULT NULL after department;

-- Create login_history table
CREATE TABLE `login_history` (
    `id` int NOT NULL AUTO_INCREMENT,
    `entity_type` ENUM('admin', 'brand_user', 'receptionist') NOT NULL,
    `entity_id` int NOT NULL,
    `device_id` varchar(255) NOT NULL,
    `is_active` tinyint(1) DEFAULT '1',
    `login_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `logout_time` timestamp NULL DEFAULT NULL,
    `last_activity` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `entity_type_id` (`entity_type`, `entity_id`)
);

-- Create customers table with proper constraints
CREATE TABLE `customers` (
    `id` int NOT NULL AUTO_INCREMENT,
    `customer_name` varchar(100) DEFAULT NULL,
    `phone_no_primary` varchar(15) DEFAULT NULL,
    `phone_no_secondary` varchar(15) DEFAULT NULL,
    `email_id` varchar(100) DEFAULT NULL,
    `address` text,
    `country` varchar(15) DEFAULT NULL,
    `designation` varchar(50) DEFAULT NULL,
    `disposition` varchar(50) DEFAULT 'interested',
    `QUEUE_NAME` varchar(50) DEFAULT NULL,
    `comment` text,
    `date_created` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `C_unique_id` varchar(50) DEFAULT NULL,
    `last_updated` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `team_id` int NOT NULL,
    `agent_name` varchar(50) NOT NULL,
    `scheduled_at` datetime DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `unique_team_customer_id` (`team_id`,`C_unique_id`),
    KEY `agent_name_team` (`agent_name`,`team_id`),
    CONSTRAINT `customers_agent_fk` FOREIGN KEY (`agent_name`, `team_id`) 
        REFERENCES `team_members` (`username`, `team_id`),
    CONSTRAINT `customers_team_fk` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add a default value for agent_name for existing records
UPDATE customers SET agent_name = 'Unknown' WHERE agent_name IS NULL;

-- Create customer_field_values table
CREATE TABLE IF NOT EXISTS customer_field_values (
    id INT PRIMARY KEY AUTO_INCREMENT,
    field_name VARCHAR(50) NOT NULL,
    field_value VARCHAR(100) NOT NULL,
    UNIQUE KEY unique_field_value (field_name, field_value)
);

-- Create instances table
CREATE TABLE IF NOT EXISTS instances (
    id INT AUTO_INCREMENT,
    instance_id VARCHAR(255) NOT NULL,
    register_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'disconnected',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY unique_instance_id (instance_id),
    FOREIGN KEY (register_id) REFERENCES admin(email) ON DELETE CASCADE,
    UNIQUE KEY unique_register_id (register_id)
);

-- ****************
-- First drop the foreign key constraint
ALTER TABLE instances DROP FOREIGN KEY instances_user_fk;

-- Finally recreate the foreign key constraint
ALTER TABLE instances 
  ADD CONSTRAINT instances_user_fk
  FOREIGN KEY (register_id)
  REFERENCES users(email)
  ON DELETE CASCADE;
-- ****************

-- 1. Drop the old FK
ALTER TABLE instances
  DROP FOREIGN KEY instances_ibfk_1;

-- 2. Add a new FK that targets users.email
ALTER TABLE instances
  ADD CONSTRAINT instances_user_fk
  FOREIGN KEY (register_id)
  REFERENCES users(email)
  ON DELETE CASCADE;

-- Create trigger to automatically generate instance_id from admin's username
DROP TRIGGER IF EXISTS before_instance_insert;
DELIMITER //
CREATE TRIGGER before_instance_insert
BEFORE INSERT ON instances
FOR EACH ROW
BEGIN
    IF NEW.instance_id IS NULL OR NEW.instance_id = '' THEN
        DECLARE first_name VARCHAR(255);
        SELECT SUBSTRING_INDEX(username,' ',1)
          INTO first_name
          FROM users
         WHERE email = NEW.register_id
         LIMIT 1;
        SET NEW.instance_id = first_name;
    END IF;
END$$
DELIMITER ;








-- Insert default values for disposition
INSERT INTO customer_field_values (field_name, field_value) VALUES 
('disposition', 'call_back'),
('disposition', 'schedule_visit'),
('disposition', 'office_visit'),
('disposition', 'urgent_required'),
('disposition', 'interested'),
('disposition', 'utility_call'),
('disposition', 'emergency');

-- Create updates_customer
CREATE TABLE `updates_customer` (
    `id` int NOT NULL AUTO_INCREMENT,
    `customer_id` int NOT NULL,
    `C_unique_id` varchar(50) NOT NULL,
    `field` varchar(255) NOT NULL,
    `old_value` text,
    `new_value` text,
    `changed_at` datetime DEFAULT CURRENT_TIMESTAMP,
    `phone_no_primary` varchar(15) DEFAULT NULL,
    `changed_by` varchar(100) NOT NULL,
    `team_id` INT NOT NULL,
    PRIMARY KEY (`id`),
    KEY `customer_id` (`customer_id`),
    KEY `changed_by_team` (`changed_by`, `team_id`),
    CONSTRAINT `updates_customer_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
    CONSTRAINT `updates_customer_team_fk` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`),
    CONSTRAINT `updates_customer_agent_fk` FOREIGN KEY (`changed_by`, `team_id`) 
        REFERENCES `team_members` (`username`, `team_id`) ON UPDATE CASCADE
);

-- Drop the foreign key constraint
ALTER TABLE updates_customer 
DROP FOREIGN KEY updates_customer_agent_fk;

-- ******************
-- Create scheduler table
CREATE TABLE `scheduler` (
    `id` int NOT NULL AUTO_INCREMENT,
    `customer_id` int NOT NULL,
    `scheduled_at` datetime NOT NULL,
    `created_by` int NOT NULL,
    `assigned_to` varchar(100) NOT NULL,
    `team_id` INT NOT NULL,
    `description` text,
    `status` ENUM('pending', 'completed', 'cancelled') DEFAULT 'pending',
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `customer_id` (`customer_id`),
    KEY `created_by` (`created_by`),
    KEY `assigned_team` (`assigned_to`, `team_id`),
    CONSTRAINT `scheduler_customer_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
    CONSTRAINT `scheduler_created_fk` FOREIGN KEY (`created_by`) REFERENCES `team_members` (`id`),
    CONSTRAINT `scheduler_team_fk` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`),
    CONSTRAINT `scheduler_assigned_fk` FOREIGN KEY (`assigned_to`, `team_id`) 
        REFERENCES `team_members` (`username`, `team_id`) ON UPDATE CASCADE
);
-- ********************
-- ********************
-- ********************
-- *******************
-- 27th ,may 2025
-- *******************
-- *******************
-- *******************

-- Create receptionist table
CREATE TABLE IF NOT EXISTS receptionist (
    id INT AUTO_INCREMENT PRIMARY KEY,
    receptionist_name VARCHAR(100) NOT NULL,
    receptionist_phone VARCHAR(15),
    receptionist_email VARCHAR(100),
    rec_other_detail TEXT,
    business_center_id INT NOT NULL,
    brand_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (business_center_id) REFERENCES business_center(id) ON DELETE CASCADE,
    FOREIGN KEY (brand_id) REFERENCES brand(id) ON DELETE CASCADE
);

alter table receptionist add column rec_password VARCHAR(255) after receptionist_email;

DELIMITER $$

DROP TRIGGER IF EXISTS before_receptionist_insert$$

CREATE TRIGGER before_receptionist_insert
BEFORE INSERT ON receptionist
FOR EACH ROW
BEGIN
    DECLARE bc_brand_id INT;
    
    -- Get brand_id from business_center
    SELECT brand_id INTO bc_brand_id
    FROM business_center 
    WHERE id = NEW.business_center_id;
    
    -- Set the brand_id
    SET NEW.brand_id = bc_brand_id;
END$$

DROP TRIGGER IF EXISTS after_receptionist_insert$$

CREATE TRIGGER after_receptionist_insert
AFTER INSERT ON receptionist
FOR EACH ROW
BEGIN
    -- Create user account for receptionist
    INSERT INTO users (
        username,
        email,
        password,
        role_id,
        business_center_id,
        brand_id
    )
    SELECT 
        NEW.receptionist_name,
        NEW.receptionist_email,
        '$2b$10$vB8FzjqZ.XmA1mJs4SANpeI2LK9GrORmUgU2Pgwb5oTRZTVkinhry', -- Hashed version of '12345678'
        r.id,
        NEW.business_center_id,
        NEW.brand_id
    FROM roles r
    WHERE r.role_name = 'receptionist';
END$$

DROP TRIGGER IF EXISTS update_receptionist_modtime$$

CREATE TRIGGER update_receptionist_modtime
BEFORE UPDATE ON receptionist
FOR EACH ROW
BEGIN
    DECLARE bc_brand_id INT;
    
    SET NEW.updated_at = CURRENT_TIMESTAMP;
    
    -- If business_center_id changes, update brand_id
    IF NEW.business_center_id != OLD.business_center_id THEN
        SELECT brand_id INTO bc_brand_id
        FROM business_center 
        WHERE id = NEW.business_center_id;
        
        SET NEW.brand_id = bc_brand_id;
    END IF;
END$$

DELIMITER ;

-- ***************
-- ***************
-- ***************
-- ***************
-- ***************


-- Table List
-- 1 admin
-- 2 brand
-- 3 business_center
-- 4 customer_field_values
-- 5 customers
-- 6 instances
-- 7 login_history
-- 8 receptionist
-- 9 roles
-- 10 scheduler
-- 11 team_members
-- 12 teams
-- 13 updates_customer
-- 14 users


-- 3rd June 2025

ALTER TABLE roles 
MODIFY COLUMN role_name ENUM('admin', 'brand_user', 'business_admin', 'receptionist') NOT NULL;
ALTER TABLE login_history 
MODIFY COLUMN entity_type ENUM('admin', 'brand_user', 'business_admin', 'receptionist') NOT NULL;
INSERT INTO roles (role_name) VALUES 
    ('business_admin');
ALTER TABLE users DROP INDEX username;



-- Create trigger for business_admin user creation

DROP TRIGGER IF EXISTS after_business_center_insert;
DELIMITER $$
CREATE TRIGGER after_business_center_insert
AFTER INSERT ON business_center
FOR EACH ROW
BEGIN
    -- Create user account for business admin
    INSERT INTO users (
        username,
        email,
        password,
        role_id,
        business_center_id,
        brand_id
    )
    SELECT 
        NEW.business_person,
        NEW.business_email,
        '$2b$10$vB8FzjqZ.XmA1mJs4SANpeI2LK9GrORmUgU2Pgwb5oTRZTVkinhry', -- Hashed version of '12345678'
        r.id,
        NEW.id,
        NEW.brand_id
    FROM roles r
    WHERE r.role_name = 'business_admin';
END$$

DELIMITER ;



-- Create trigger to handle user creation from brand
DELIMITER $$

DROP TRIGGER IF EXISTS after_brand_insert$$

CREATE TRIGGER after_brand_insert
AFTER INSERT ON brand
FOR EACH ROW
BEGIN
    -- Create user account for brand user with hashed password
    INSERT INTO users (
        username,
        email,
        password,
        role_id,
        brand_id
    )
    SELECT 
        NEW.brand_name,
        NEW.brand_email,
        '$2b$10$vB8FzjqZ.XmA1mJs4SANpeI2LK9GrORmUgU2Pgwb5oTRZTVkinhry', -- Hashed version of '12345678'
        r.id,
        NEW.id
    FROM roles r
    WHERE r.role_name = 'brand_user';
END$$

DELIMITER ;



-- **********************
-- Trip
-- **********************

-- **********************
-- **********************
-- ********************
-- 27th ,may 2025
-- ********************
-- ********************
-- **********************


-- First drop existing triggers
DROP TRIGGER IF EXISTS after_customers_scheduled_at_update;

DELIMITER //
DROP TRIGGER IF EXISTS after_customers_scheduled_at_insert;
-- Create insert trigger
CREATE TRIGGER after_customers_scheduled_at_insert
AFTER INSERT ON customers 
FOR EACH ROW 
BEGIN
    DECLARE agent_id INT;
    
    IF NEW.scheduled_at IS NOT NULL THEN
        -- Get the team_member id
        SELECT id INTO agent_id 
        FROM team_members 
        WHERE username = NEW.agent_name 
        AND team_id = NEW.team_id 
        LIMIT 1;
        
        -- Insert into scheduler
        INSERT INTO scheduler (
            customer_id,
            C_unique_id,
            scheduled_at,
            status,
            created_by,
            team_id,
            notes
        ) VALUES (
            NEW.id,
            NEW.C_unique_id,
            NEW.scheduled_at,
            'pending',
            NEW.agent_name,
            NEW.team_id,
            NEW.comment
        );
    END IF;
END
//

DELIMITER ;

-- Create update trigger
CREATE TRIGGER after_customers_scheduled_at_update 
AFTER UPDATE ON customers 
FOR EACH ROW 
BEGIN
    DECLARE agent_id INT;
    
    IF NEW.scheduled_at IS NOT NULL AND 
       (OLD.scheduled_at IS NULL OR NEW.scheduled_at != OLD.scheduled_at) THEN
        
        -- Get the team_member id
        SELECT id INTO agent_id 
        FROM team_members 
        WHERE username = NEW.agent_name 
        AND team_id = NEW.team_id 
        LIMIT 1;
        
        -- Insert or update scheduler
        INSERT INTO scheduler (
            customer_id,
            scheduled_at,
            created_by,
            assigned_to,
            team_id,
            description,
            status
        ) VALUES (
            NEW.id,
            NEW.scheduled_at,
            agent_id,
            NEW.agent_name,
            NEW.team_id,
            NEW.comment,
            'pending'
        )
        ON DUPLICATE KEY UPDATE
            scheduled_at = NEW.scheduled_at,
            description = NEW.comment,
            updated_at = CURRENT_TIMESTAMP;
    END IF;
END//

DELIMITER ;

-- Now migrate existing data
INSERT INTO scheduler (
    customer_id,
    scheduled_at,
    created_by,
    assigned_to,
    team_id,
    description,
    status
)
SELECT 
    c.id,
    c.scheduled_at,
    tm.id,
    c.agent_name,
    c.team_id,
    c.comment,
    'pending'
FROM customers c
INNER JOIN team_members tm ON tm.username = c.agent_name AND tm.team_id = c.team_id
WHERE c.scheduled_at IS NOT NULL
ON DUPLICATE KEY UPDATE
    scheduled_at = VALUES(scheduled_at),
    description = VALUES(description),
    updated_at = CURRENT_TIMESTAMP;

-- Drop and recreate created_by column
ALTER TABLE customers DROP COLUMN created_by;

ALTER TABLE customers ADD COLUMN created_by VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Unknown';

-- Update any existing rows
UPDATE customers SET created_by = 'Unknown' WHERE created_by IS NULL;


-- Drop the created_by column from customers table
ALTER TABLE customers DROP COLUMN created_by;






DROP TRIGGER IF EXISTS after_customer_insert;
DROP TRIGGER IF EXISTS after_customer_update;

-- Update the after_customer_insert trigger to use agent_name
DELIMITER //
CREATE TRIGGER after_customer_insert
AFTER INSERT ON customers
FOR EACH ROW
BEGIN
    INSERT INTO updates_customer (
        customer_id,
        C_unique_id,
        field,
        old_value,
        new_value,
        changed_at,
        phone_no_primary,
        changed_by
    ) VALUES (
        NEW.id,
        NEW.C_unique_id,
        'created',
        NULL,
        'New customer created',
        NOW(),
        NEW.phone_no_primary,
        NEW.agent_name
    );
END//
DELIMITER ;

DELIMITER //
CREATE TRIGGER after_customer_update
AFTER UPDATE ON customers
FOR EACH ROW
BEGIN
    INSERT INTO updates_customer (
        customer_id,
        C_unique_id,
        field,
        old_value,
        new_value,
        changed_at,
        phone_no_primary,
        changed_by
    ) VALUES (
        NEW.id,
        NEW.C_unique_id,
        'updated',
        NULL,
        'Customer updated',
        NOW(),
        NEW.phone_no_primary,
        NEW.agent_name
    );
END//
DELIMITER ;




-- *****************
-- *****************
-- *****************
-- *****************

drop table scheduler;
drop table updates_customer;
drop table customers;

-- 1. Create customers table
CREATE TABLE `customers` (
    `id` int NOT NULL AUTO_INCREMENT,
    `customer_name` varchar(100) DEFAULT NULL,
    `phone_no_primary` varchar(15) DEFAULT NULL,
    `phone_no_secondary` varchar(15) DEFAULT NULL,
    `email_id` varchar(100) DEFAULT NULL,
    `address` text,
    `country` varchar(15) DEFAULT NULL,
    `designation` varchar(50) DEFAULT NULL,
    `disposition` varchar(50) DEFAULT 'interested',
    `QUEUE_NAME` varchar(50) DEFAULT NULL,
    `comment` text,
    `date_created` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `C_unique_id` varchar(50) DEFAULT NULL,
    `last_updated` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `team_id` int NOT NULL,
    `agent_name` varchar(50) NOT NULL,
    `scheduled_at` datetime DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `unique_team_customer_id` (`team_id`,`C_unique_id`),
    KEY `agent_name_team` (`agent_name`,`team_id`),
    CONSTRAINT `customers_team_fk` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 2. Create updates_customer table
CREATE TABLE `updates_customer` (
    `id` int NOT NULL AUTO_INCREMENT,
    `customer_id` int NOT NULL,
    `C_unique_id` varchar(50) NOT NULL,
    `field` varchar(255) NOT NULL,
    `old_value` text,
    `new_value` text,
    `updated_by` varchar(50) NOT NULL,
    `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `team_id` int NOT NULL,
    PRIMARY KEY (`id`),
    KEY `customer_id_idx` (`customer_id`),
    KEY `C_unique_id_idx` (`C_unique_id`),
    KEY `team_id_idx` (`team_id`),
    CONSTRAINT `updates_customer_customer_fk` FOREIGN KEY (`customer_id`) 
        REFERENCES `customers` (`id`),
    CONSTRAINT `updates_customer_team_fk` FOREIGN KEY (`team_id`) 
        REFERENCES `teams` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 3. Create scheduler table
CREATE TABLE `scheduler` (
    `id` int NOT NULL AUTO_INCREMENT,
    `customer_id` int NOT NULL,
    `C_unique_id` varchar(50) NOT NULL,
    `scheduled_at` datetime NOT NULL,
    `status` enum('pending','completed','cancelled') DEFAULT 'pending',
    `created_by` varchar(50) NOT NULL,
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `team_id` int NOT NULL,
    `notes` text,
    PRIMARY KEY (`id`),
    UNIQUE KEY `unique_customer_schedule` (`customer_id`, `scheduled_at`),
    KEY `C_unique_id_idx` (`C_unique_id`),
    KEY `team_id_idx` (`team_id`),
    CONSTRAINT `scheduler_customer_fk` FOREIGN KEY (`customer_id`) 
        REFERENCES `customers` (`id`),
    CONSTRAINT `scheduler_team_fk` FOREIGN KEY (`team_id`) 
        REFERENCES `teams` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



DROP TRIGGER IF EXISTS after_customers_scheduled_at_insert;
DELIMITER //

CREATE TRIGGER after_customers_scheduled_at_insert
AFTER INSERT ON customers 
FOR EACH ROW 
BEGIN
    DECLARE agent_id INT;
    
    IF NEW.scheduled_at IS NOT NULL THEN
        -- Get the team_member id
        SELECT id INTO agent_id 
        FROM team_members 
        WHERE username = NEW.agent_name 
        AND team_id = NEW.team_id 
        LIMIT 1;
        
        -- Insert into scheduler
        INSERT INTO scheduler (
            customer_id,
            C_unique_id,
            scheduled_at,
            status,
            created_by,
            team_id,
            notes
        ) VALUES (
            NEW.id,
            NEW.C_unique_id,
            NEW.scheduled_at,
            'pending',
            NEW.agent_name,
            NEW.team_id,
            NEW.comment
        );
    END IF;
END
//

DELIMITER ;




-- ****************************
-- Reports Table (18 June 2025)
-- ****************************
CREATE TABLE IF NOT EXISTS reports_user_charges (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_name VARCHAR(100) NULL,
    extension VARCHAR(100) NULL,
    tags VARCHAR(100) NULL,
    total_calls VARCHAR(100) NULL,
    inbound_total_calls VARCHAR(100) NULL,
    outbound_total_calls VARCHAR(100) NULL,
    minutes VARCHAR(100) NULL,
    amount VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_name (user_name)
);

-- ****************************
-- Reports Outbound Calls Table (18 June 2025)
-- ****************************
CREATE TABLE IF NOT EXISTS reports_outbound_calls (
    `ID` VARCHAR(100) NULL,
    `Call ID` VARCHAR(100) NULL,
    `Other Leg Call ID` VARCHAR(100) NULL,
    `Call Start Time` VARCHAR(100) NULL,
    `Hangup time` VARCHAR(100) NULL,
    `Caller ID Name` VARCHAR(100) NULL,
    `Caller ID Number` VARCHAR(100) NULL,
    `User Name` VARCHAR(100) NULL,
    `Extension` VARCHAR(100) NULL,
    `User email` VARCHAR(100) NULL,
    `Dialed Number` VARCHAR(100) NULL,
    `Outbound Dialed Number` VARCHAR(100) NULL,
    `Duration seconds` VARCHAR(100) NULL,
    `Billing seconds (Talked Duration)` VARCHAR(100) NULL,
    `Wait Duration` VARCHAR(100) NULL,
    `Hangup Cause` VARCHAR(100) NULL,
    `Media Recording ID` VARCHAR(100) NULL,
    `Media Name` VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_name_outbound (`User Name`)
);

-- ****************************
-- Reports Inbound Calls Table (18 June 2025)
-- ****************************
CREATE TABLE IF NOT EXISTS reports_inbound_calls (
    `ID` VARCHAR(100) NULL,
    `Call ID` VARCHAR(100) NULL,
    `Other Leg Call ID` VARCHAR(100) NULL,
    `Start Time` VARCHAR(100) NULL,
    `Caller ID Name` VARCHAR(100) NULL,
    `Caller ID Number` VARCHAR(100) NULL,
    `Dialed Number` VARCHAR(100) NULL,
    `Callee ID Name` VARCHAR(100) NULL,
    `Callee ID Number` VARCHAR(100) NULL,
    `Duration seconds` VARCHAR(100) NULL,
    `Billing seconds` VARCHAR(100) NULL,
    `Hangup Cause` VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_caller_id_inbound (`Caller ID Number`)
);





















