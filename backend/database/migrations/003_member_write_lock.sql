CREATE TABLE IF NOT EXISTS member_write_lock (
    id INT PRIMARY KEY CHECK (id = 1)
) ENGINE=InnoDB;

INSERT INTO member_write_lock (id) VALUES (1) ON DUPLICATE KEY UPDATE id = id;
