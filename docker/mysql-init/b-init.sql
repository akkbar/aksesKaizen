DROP USER IF EXISTS 'openaiotadmin'@'%';
CREATE USER 'openaiotadmin'@'%' IDENTIFIED BY 'OpenAIoT-mysql-password';
GRANT ALL PRIVILEGES ON *.* TO 'openaiotadmin'@'%';
FLUSH PRIVILEGES;

-- --------------------------------------------------------
-- Host:                         127.0.0.1
-- Server version:               8.4.3 - MySQL Community Server - GPL
-- Server OS:                    Linux
-- HeidiSQL Version:             12.3.0.6589
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


-- Dumping database structure for db_main
CREATE DATABASE IF NOT EXISTS `db_main` /*!40100 DEFAULT CHARACTER SET utf8mb3 */ /*!80016 DEFAULT ENCRYPTION='N' */;
USE `db_main`;

-- Dumping structure for table db_main.error_logs
CREATE TABLE IF NOT EXISTS `error_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `level` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `stack` text,
  `additional_info` json DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

-- Data exporting was unselected.

-- Dumping structure for table db_main.plants
CREATE TABLE IF NOT EXISTS `plants` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `plant_name` varchar(50) DEFAULT NULL,
  `applist1` bigint unsigned DEFAULT NULL,
  `applist2` bigint unsigned DEFAULT NULL,
  `applist3` bigint unsigned DEFAULT NULL,
  `logo` varchar(50) DEFAULT NULL,
  `add_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `update_date` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

-- Dumping structure for table db_main.sessions
CREATE TABLE IF NOT EXISTS `sessions` (
  `sid` varchar(255) NOT NULL,
  `expired` datetime NOT NULL,
  `sess` json NOT NULL,
  PRIMARY KEY (`sid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

-- Dumping structure for table db_main.users
CREATE TABLE IF NOT EXISTS `users` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `username` varchar(50) DEFAULT NULL,
  `password` varchar(500) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `fullname` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `user_role` enum('Admin','Manager','Operator') DEFAULT NULL,
  `plant_id` int unsigned DEFAULT NULL,
  `last_app` tinyint unsigned DEFAULT NULL,
  `token` varchar(500) DEFAULT NULL,
  `add_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `update_date` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `user_img` varchar(50) DEFAULT NULL,
  `isactive` tinyint DEFAULT '1',
  `last_login` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb3;

-- Data exporting was unselected.

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;


INSERT INTO `users` (`id`, `username`, `password`, `fullname`, `user_role`, `plant_id`, `last_app`, `token`, `add_date`, `update_date`, `user_img`, `isactive`, `last_login`) VALUES (3, 'admin', '$2b$10$I/Vs/mDsuohyG2rzFbcqpuAVHMSAvVHRlfwbqoU7FIkb0k7DctMna', 'Admin', 'Admin', 100, NULL, NULL, '2025-01-11 07:59:38', '2025-01-12 13:49:03', NULL, 1, NULL);

