import connection from "../model/database.js";

export const getEventWithCustomerCount = async (req, res) => {
    const { eventId } = req.params;
    const currentPage = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.per_page) || 10;

    try {
        // Query pagination
        const [countResults] = await connection.query(
            "SELECT COUNT(*) as total FROM registrations WHERE event_id = ?",
            [eventId]
        );
        const totalCustomers = countResults[0].total;
        const totalPages = Math.ceil(totalCustomers / perPage);
        const offset = (currentPage - 1) * perPage;

        // Query customers
        const [eventResults] = await connection.query(
            `SELECT e.*, c.* 
            FROM event e 
            LEFT JOIN registrations r ON e.id = r.event_id 
            LEFT JOIN customerinfo c ON r.customer_id = c.customer_id 
            WHERE e.id = ? 
            LIMIT ? OFFSET ?`,
            [eventId, perPage, offset]
        );

        if (eventResults.length === 0) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // แปลง startDate และ endDate เป็นสตริง ISO เพื่อดึงแค่ส่วนวันที่
        const startDateStr = eventResults[0].startDate.toISOString().split('T')[0];
        const endDateStr = eventResults[0].endDate.toISOString().split('T')[0];
        const startTime = new Date(`${startDateStr}T${eventResults[0].startTime}`);
        const endTime = new Date(`${endDateStr}T${eventResults[0].endTime}`);

        // ตรวจสอบเวลาปัจจุบัน เทียบกับเวลาของกิจกรรม
        const currentTime = new Date();
        let statusMessage = '';
        if (currentTime < startTime) {
            statusMessage = "ยังไม่ถึงเวลาเริ่มกิจกรรมที่กำหนด";
        } else if (currentTime > endTime) {
            statusMessage = "เลยเวลาที่กำหนด";
        } else {
            statusMessage = "เข้าร่วมสำเร็จ";
        }

        // Format structure
        const eventData = {
            id: eventResults[0].id,
            activityName: eventResults[0].activityName,
            course: eventResults[0].course,
            startDate: eventResults[0].startDate,
            endDate: eventResults[0].endDate,
            startTime: eventResults[0].startTime,
            endTime: eventResults[0].endTime,
            Nameplace: eventResults[0].Nameplace,
            latitude: eventResults[0].latitude,
            longitude: eventResults[0].longitude,
            province: eventResults[0].province,
            admin_id: eventResults[0].admin_id,
            event_type: eventResults[0].event_type,
            created_at: eventResults[0].created_at,
            status: statusMessage, // แสดงสถานะกิจกรรม
            listST: eventResults.map(row => ({
                id: row.customer_id,
                customer_id: row.customer_id,
                name: row.name,
                picture: row.picture,
                email: row.email,
                first_name: row.first_name,
                last_name: row.last_name,
                user_code: row.user_code,
                group_st: row.group_st,
                branch_st: row.branch_st,
                tpye_st: row.tpye_st,
                st_tpye: row.st_tpye,
                total_point: row.total_point,
                faceUrl: row.faceUrl,
                levelST: row.levelST
            }))
        };

        const meta = {
            total: totalCustomers,
            per_page: perPage,
            current_page: currentPage,
            last_page: totalPages,
            first_page: 1,
            first_page_url: `/?page=1`,
            last_page_url: `/?page=${totalPages}`,
            next_page_url: currentPage < totalPages ? `/?page=${currentPage + 1}` : null,
            previous_page_url: currentPage > 1 ? `/?page=${currentPage - 1}` : null
        };

        return res.status(200).json({
            meta: meta,
            data: eventData
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const registerCustomerForEvent = async (req, res) => {
    const { eventId } = req.params;
    const { customerId } = req.body;

    if (!customerId) {
        return res.status(400).json({ message: "กรุณาระบุ customerId" });
    }

    try {
        const [eventResults] = await connection.query(
            "SELECT * FROM event WHERE id = ? AND admin_id IS NOT NULL",
            [eventId]
        );

        if (eventResults.length === 0) {
            return res.status(404).json({ message: "Event not found or not created by an admin" });
        }

        const [registrationResults] = await connection.query(
            "SELECT * FROM registrations WHERE event_id = ? AND customer_id = ?",
            [eventId, customerId]
        );

        if (registrationResults.length > 0) {
            return res.status(400).json({ message: "ท่านได้ลงชื่อเข้าร่วมไปแล้ว" });
        }

        await connection.query(
            "INSERT INTO registrations (event_id, customer_id) VALUES (?, ?)",
            [eventId, customerId]
        );

        // การส่งข้อความสถานะการลงทะเบียน
        return res.status(201).json({ message: "เข้าร่วมสำเร็จ." });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const getRegisteredEventsForCustomer = async (req, res) => {
    const { customerId } = req.body; // รับ customerId จาก body
    const currentPage = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.per_page) || 10;

    if (!customerId) {
        return res.status(400).json({ message: "กรุณาระบุ customerId ใน request body" });
    }

    try {
        // ตรวจสอบว่ามี customer หรือไม่
        const [customerResults] = await connection.query(
            "SELECT * FROM customerinfo WHERE customer_id = ?",
            [customerId]
        );

        if (customerResults.length === 0) {
            return res.status(404).json({ message: "Customer not found" });
        }

        // Query pagination
        const [countResults] = await connection.query(
            "SELECT COUNT(*) as total FROM registrations WHERE customer_id = ?",
            [customerId]
        );
        const totalRegistrations = countResults[0].total;
        const totalPages = Math.ceil(totalRegistrations / perPage);
        const offset = (currentPage - 1) * perPage;

        // ดึงรายการกิจกรรมที่ลูกค้าได้ลงทะเบียน
        const [eventResults] = await connection.query(
            `SELECT e.*, r.* 
            FROM event e 
            LEFT JOIN registrations r ON e.id = r.event_id 
            WHERE r.customer_id = ? 
            LIMIT ? OFFSET ?`,
            [customerId, perPage, offset]
        );

        if (eventResults.length === 0) {
            return res.status(404).json({ message: 'No events found for this customer' });
        }

        // แปลง startDate และ endDate เป็นสตริง ISO เพื่อดึงแค่ส่วนวันที่
        const eventsData = eventResults.map(row => ({
            eventId: row.id,
            activityName: row.activityName,
            course: row.course,
            startDate: row.startDate,
            endDate: row.endDate,
            startTime: row.startTime,
            endTime: row.endTime,
            Nameplace: row.Nameplace,
            province: row.province,
            // ตรวจสอบสถานะการเข้าร่วม
            status: row.customer_id ? 'เข้าร่วมสำเร็จ' : 'ไม่สำเร็จ'
        }));

        const meta = {
            total: totalRegistrations,
            per_page: perPage,
            current_page: currentPage,
            last_page: totalPages,
            first_page: 1,
            first_page_url: `/?page=1`,
            last_page_url: `/?page=${totalPages}`,
            next_page_url: currentPage < totalPages ? `/?page=${currentPage + 1}` : null,
            previous_page_url: currentPage > 1 ? `/?page=${currentPage - 1}` : null
        };

        return res.status(200).json({
            meta: meta,
            data: eventsData
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Internal server error" });
    }
};


