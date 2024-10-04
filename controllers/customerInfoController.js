import connection from '../model/database.js'; // สมมติว่าคุณมีไฟล์เชื่อมต่อ database แยก

// สร้างหรือล็อกอินผู้ใช้
export const createOrLoginCustomer = async (req, res) => {
    const { customer_id, name, picture } = req.body;

    try {
        connection.query(
            "SELECT * FROM customerinfo WHERE customer_id = ?",
            [customer_id],
            (err, results, fields) => {
                if (err) {
                    console.log("Error querying the database", err);
                    return res.status(500).send("Internal server error");
                }

                if (results.length === 0) {
                    connection.query(
                        "INSERT INTO customerinfo (customer_id, name, picture) VALUES (?, ?, ?)",
                        [customer_id, name, picture],
                        (err, insertResults, fields) => {
                            if (err) {
                                console.log("Cannot insert a user into the database", err);
                                return res.status(400).send("Error inserting user");
                            }

                            connection.query(
                                "SELECT * FROM customerinfo WHERE id = ?",
                                [insertResults.insertId],
                                (err, newUserResults, fields) => {
                                    if (err) {
                                        console.log("Error retrieving the newly created user", err);
                                        return res.status(500).send("Error retrieving user");
                                    }

                                    return res.status(201).json({ message: 'Customer info created', user: newUserResults[0] });
                                }
                            );
                        }
                    );
                } else {
                    return res.status(200).json({ message: 'Login successful', user: results[0] });
                }
            }
        );
    } catch (err) {
        console.log(err);
        return res.status(500).send("Internal server error");
    }
};

// อัปเดตข้อมูลผู้ใช้
export const updateCustomerProfile = async (req, res) => {
    const { customer_id, first_name, last_name, user_code, group_st, branch_st, tpye_st, st_tpye, levelST } = req.body;

    try {
        connection.query(
            "SELECT * FROM customerinfo WHERE customer_id = ?",
            [customer_id],
            (err, results, fields) => {
                if (err) {
                    console.log("Error querying the database", err);
                    return res.status(500).send("Internal server error");
                }

                if (results.length === 0) {
                    return res.status(404).json({ message: 'User not found' });
                }

                connection.query(
                    "UPDATE customerinfo SET first_name = ?, last_name = ?, user_code = ?, group_st = ?, branch_st = ?, tpye_st = ?, st_tpye = ?, levelST = ? WHERE customer_id = ?",
                    [first_name, last_name, user_code, group_st, branch_st, tpye_st, st_tpye, levelST, customer_id],
                    (err, updateResults, fields) => {
                        if (err) {
                            console.log("Error updating the user profile", err);
                            return res.status(400).send("Error updating profile");
                        }

                        connection.query(
                            "SELECT * FROM customerinfo WHERE customer_id = ?",
                            [customer_id],
                            (err, updatedUserResults, fields) => {
                                if (err) {
                                    console.log("Error retrieving the updated user", err);
                                    return res.status(500).send("Error retrieving user");
                                }

                                return res.status(200).json({ message: 'Profile updated successfully', user: updatedUserResults[0] });
                            }
                        );
                    }
                );
            }
        );
    } catch (err) {
        console.log(err);
        return res.status(500).send("Internal server error");
    }
};
