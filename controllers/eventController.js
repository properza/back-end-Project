import connection from "../model/database.js";

export const getEventWithCustomerCount = async (req, res) => {
    const { eventId } = req.params;
    const currentPage = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.per_page) || 10;

    try {
        // Query the total count of customers for pagination
        const [countResults] = await connection.query(
            "SELECT COUNT(*) as total FROM registrations WHERE event_id = ?",
            [eventId]
        );
        const totalCustomers = countResults[0].total;
        const totalPages = Math.ceil(totalCustomers / perPage);
        const offset = (currentPage - 1) * perPage;

        // Query the event details and list of customers
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

        // Format the event and customer details into the requested structure
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
        // ตรวจสอบว่า event มีอยู่จริงในตาราง event
        const [eventResults] = await connection.query(
            "SELECT * FROM event WHERE id = ? AND admin_id IS NOT NULL",
            [eventId]
        );

        if (eventResults.length === 0) {
            return res.status(404).json({ message: "Event not found or not created by an admin" });
        }

        // ตรวจสอบว่าลูกค้าลงทะเบียนในกิจกรรมนี้แล้วหรือไม่
        const [registrationResults] = await connection.query(
            "SELECT * FROM registrations WHERE event_id = ? AND customer_id = ?",
            [eventId, customerId]
        );

        if (registrationResults.length > 0) {
            return res.status(400).json({ message: "ท่านได้ลงชื่อเข้าร่วมไปแล้ว" });
        }

        // บันทึกการลงทะเบียนของลูกค้า
        await connection.query(
            "INSERT INTO registrations (event_id, customer_id) VALUES (?, ?)",
            [eventId, customerId]
        );

        return res.status(201).json({ message: "เข้าร่วมสำเร็จ." });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Internal server error" });
    }
};



