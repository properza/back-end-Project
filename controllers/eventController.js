import connection from "../model/database.js";

export const getEventWithCustomerCount = async (req, res) => {
    const { eventId } = req.params;
    const currentPage = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.per_page) || 10;

    try {
        const [countResults] = await connection.query(
            "SELECT COUNT(*) as total FROM registrations WHERE event_id = ?",
            [eventId]
        );
        const totalCustomers = countResults[0].total;
        const totalPages = Math.ceil(totalCustomers / perPage);
        const offset = (currentPage - 1) * perPage;

        const [eventResults] = await connection.query(
            `SELECT e.*, r.*, c.*, r.images AS registrationImages
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
            listST: eventResults.map(row => ({
                id: row.customer_id,
                customer_id: row.customer_id,
                name: row.name,
                picture: row.picture,
                images: row.registrationImages ? JSON.parse(row.registrationImages) : []
            }))
        };

        const meta = {
            total: totalCustomers,
            per_page: perPage,
            current_page: currentPage,
            last_page: totalPages
        };

        return res.status(200).json({ meta, data: eventData });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const registerCustomerForEvent = async (req, res) => {
    const { eventId } = req.params;
    const { customerId, images } = req.body;

    if (!customerId) {
        return res.status(400).json({ message: "กรุณาระบุ customerId" });
    }

    let imagesJson = null;
    if (images) {
        if (!Array.isArray(images)) {
            return res.status(400).json({ message: "images ควรเป็น array ของลิงก์รูป" });
        }
        imagesJson = JSON.stringify(images);
    }

    try {
        const [eventResults] = await connection.query(
            "SELECT * FROM event WHERE id = ? AND admin_id IS NOT NULL",
            [eventId]
        );

        if (eventResults.length === 0) {
            return res.status(404).json({ message: "ไม่พบกิจกรรมหรือกิจกรรมไม่ได้ถูกสร้างโดย admin" });
        }

        const eventDetails = eventResults[0];
        const currentUTC = new Date();
        const currentTime = new Date(currentUTC.getTime() + 7 * 60 * 60 * 1000);

        const [registrationResults] = await connection.query(
            "SELECT * FROM registrations WHERE event_id = ? AND customer_id = ? ORDER BY created_at ASC",
            [eventId, customerId]
        );

        if (currentTime < new Date(eventDetails.startDate + "T" + eventDetails.startTime)) {
            if (registrationResults.length === 0) {
                await connection.query(
                    "INSERT INTO registrations (event_id, customer_id, check_type, images) VALUES (?, ?, 'in', ?)",
                    [eventId, customerId, imagesJson]
                );
                return res.status(201).json({ message: "เช็คชื่อเข้าร่วมกิจกรรมสำเร็จ (ล่วงหน้า)" });
            }
        } else if (currentTime >= new Date(eventDetails.startDate + "T" + eventDetails.startTime) &&
            currentTime <= new Date(eventDetails.endDate + "T" + eventDetails.endTime)) {
            if (registrationResults.length === 0) {
                await connection.query(
                    "INSERT INTO registrations (event_id, customer_id, check_type, images) VALUES (?, ?, 'in', ?)",
                    [eventId, customerId, imagesJson]
                );
                return res.status(201).json({ message: "เช็คชื่อเข้าร่วมกิจกรรมสำเร็จ" });
            } else if (registrationResults[0].check_type === 'in') {
                await connection.query(
                    "INSERT INTO registrations (event_id, customer_id, check_type) VALUES (?, ?, 'out')",
                    [eventId, customerId]
                );
                return res.status(201).json({ message: "เช็คชื่อออกจากกิจกรรมสำเร็จ" });
            }
        }

        return res.status(400).json({ message: "หมดเวลาลงชื่อเข้าร่วมกิจกรรมแล้ว" });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// function mapEventData(eventDetails) {
//     let imagesArray = [];
//     if (eventDetails.images) {
//         imagesArray = JSON.parse(eventDetails.images);
//     }

//     return {
//         eventId: eventDetails.id,
//         activityName: eventDetails.activityName,
//         course: eventDetails.course,
//         startDate: eventDetails.startDate,
//         endDate: eventDetails.endDate,
//         startTime: eventDetails.startTime,
//         endTime: eventDetails.endTime,
//         Nameplace: eventDetails.Nameplace,
//         province: eventDetails.province,
//         images: imagesArray
//     };
// }

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

        // ดึงรายการกิจกรรมที่ลูกค้าได้ลงทะเบียน พร้อมเรียงลำดับจากล่าสุด
        const [eventResults] = await connection.query(
            `SELECT e.*, r.* 
            FROM event e 
            LEFT JOIN registrations r ON e.id = r.event_id 
            WHERE r.customer_id = ?
            ORDER BY r.created_at DESC
            LIMIT ? OFFSET ?`,
            [customerId, perPage, offset]
        );

        const eventsData = eventResults.map(row => {
            let imagesArray = [];
            if (row.images) {
                // หาก images เก็บเป็น JSON string ให้ parse
                // ตรวจดูด้วย console.log(row.images) ว่ามาในรูปแบบใด
                imagesArray = JSON.parse(row.images);
            }

            return {
                eventId: row.id,
                activityName: row.activityName,
                course: row.course,
                startDate: row.startDate,
                endDate: row.endDate,
                startTime: row.startTime,
                endTime: row.endTime,
                Nameplace: row.Nameplace,
                province: row.province,
                status: row.customer_id ? 'เข้าร่วมสำเร็จ' : 'ไม่สำเร็จ',
                images: imagesArray
            };
        });

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

export const EditEvent = async (req, res) => {
    const { eventId } = req.params;
    const { event_type } = req.body;

    const isSuperAdmin = req.user.role === 'super_admin'; 

    if (event_type && !['special', 'normal'].includes(event_type)) {
        return res.status(400).json({ message: 'Invalid event type' });
    }

    try {
        const [eventResults] = await connection.query(
            "SELECT * FROM event WHERE id = ?", [eventId]
        );

        if (eventResults.length === 0) {
            return res.status(404).json({ message: "Event not found" });
        }

        const event = eventResults[0];

        if (isSuperAdmin || event.event_type === event_type) {
            const updateQuery = `
                UPDATE event 
                SET activityName = ?, course = ?, startDate = ?, endDate = ?, startTime = ?, endTime = ?, event_type = ?
                WHERE id = ?
            `;
            await connection.query(updateQuery, [
                req.body.activityName, req.body.course, req.body.startDate, req.body.endDate,
                req.body.startTime, req.body.endTime, event_type || event.event_type, eventId
            ]);

            return res.status(200).json({ message: 'Event updated successfully' });
        } else {
            return res.status(403).json({ message: 'You do not have permission to edit this event' });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// Delete event function
export const DeleteEvent = async (req, res) => {
    const { eventId } = req.params;
    const { event_type } = req.body;

    const isSuperAdmin = req.user.role === 'super_admin'; 

    if (event_type && !['special', 'normal'].includes(event_type)) {
        return res.status(400).json({ message: 'Invalid event type' });
    }

    try {
        const [eventResults] = await connection.query(
            "SELECT * FROM event WHERE id = ?", [eventId]
        );

        if (eventResults.length === 0) {
            return res.status(404).json({ message: "Event not found" });
        }

        const event = eventResults[0];

        if (isSuperAdmin || event.event_type === event_type) {
            await connection.query("DELETE FROM event WHERE id = ?", [eventId]);

            return res.status(200).json({ message: 'Event deleted successfully' });
        } else {
            return res.status(403).json({ message: 'You do not have permission to delete this event' });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Internal server error" });
    }
};