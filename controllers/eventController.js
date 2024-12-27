import connection from "../model/database.js";
import { DateTime } from 'luxon'; 

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
                levelST: row.levelST,
                images: row.registrationImages
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

    // Validate customerId
    if (!customerId) {
        return res.status(400).json({ message: "กรุณาระบุ customerId" });
    }

    // Validate and stringify images
    let imagesJson = null;
    if (images) {
        if (!Array.isArray(images)) {
            return res.status(400).json({ message: "images ควรเป็น array ของลิงก์รูป" });
        }
        imagesJson = JSON.stringify(images);
    }

    try {
        // Fetch the event ensuring it's created by an admin
        const [eventResults] = await connection.query(
            "SELECT * FROM event WHERE id = ? AND admin_id IS NOT NULL",
            [eventId]
        );

        if (eventResults.length === 0) {
            return res.status(404).json({ message: "ไม่พบกิจกรรมหรือกิจกรรมไม่ได้ถูกสร้างโดย admin" });
        }

        const eventDetails = eventResults[0];
        const timezone = 'Asia/Bangkok';
        const currentTime = DateTime.now().setZone(timezone);

        // Log eventDetails for debugging
        console.log("Event Details:", eventDetails);

        // Construct ISO 8601 date-time strings
        const startDateTimeStr = eventDetails.startDate.toISOString(); // '2024-12-19T17:00:00.000Z'
        const endDateTimeStr = eventDetails.endDate.toISOString();     // '2024-12-21T17:00:00.000Z'

        // Log the constructed date-time strings
        console.log("Start DateTime String:", startDateTimeStr);
        console.log("End DateTime String:", endDateTimeStr);

        // Parse event start and end times using Luxon
        const eventStartUTC = DateTime.fromISO(startDateTimeStr, { zone: 'utc' });
        const eventEndUTC = DateTime.fromISO(endDateTimeStr, { zone: 'utc' });

        // Extract hours, minutes, and seconds from startTime and endTime
        const [startHour, startMinute, startSecond] = eventDetails.startTime.split(':').map(Number);
        const [endHour, endMinute, endSecond] = eventDetails.endTime.split(':').map(Number);

        // Convert to Asia/Bangkok timezone and set the correct time
        const eventStart = eventStartUTC.setZone(timezone).set({
            hour: startHour,
            minute: startMinute,
            second: startSecond,
            millisecond: 0
        });

        const eventEnd = eventEndUTC.setZone(timezone).set({
            hour: endHour,
            minute: endMinute,
            second: endSecond,
            millisecond: 0
        });

        // Log parsed eventStart and eventEnd
        console.log("Parsed Event Start:", eventStart.toISO());
        console.log("Parsed Event End:", eventEnd.toISO());

        // Validate parsed dates
        if (!eventStart.isValid || !eventEnd.isValid) {
            console.error("Invalid event start or end date/time format.");
            return res.status(400).json({ message: "Invalid event start or end date/time format" });
        }

        // Fetch existing registrations for the customer and event
        const [registrationResults] = await connection.query(
            "SELECT * FROM registrations WHERE event_id = ? AND customer_id = ? ORDER BY created_at ASC",
            [eventId, customerId]
        );

        // Registration Logic
        if (currentTime < eventStart) {
            // Before the event starts
            const diffBeforeStart = eventStart.diff(currentTime, 'minutes').minutes;

            if (registrationResults.length === 0) {
                if (diffBeforeStart <= 45) {
                    await connection.query(
                        "INSERT INTO registrations (event_id, customer_id, check_type, images, time_check) VALUES (?, ?, 'in', ?, ?)",
                        [eventId, customerId, imagesJson, currentTime.toISO()]
                    );
                    return res.status(201).json({ message: "เช็คชื่อเข้าร่วมกิจกรรมสำเร็จ (ล่วงหน้า)" });
                } else {
                    const hours = Math.floor(diffBeforeStart / 60);
                    const minutes = Math.floor(diffBeforeStart % 60);
                    return res.status(400).json({
                        message: `ยังไม่เริ่มกิจกรรม กิจกรรมจะเริ่มในอีก ${hours} ชั่วโมง ${minutes} นาที`
                    });
                }
            } else if (registrationResults.length === 1) {
                const lastReg = registrationResults[0];
                if (lastReg.check_type === 'in') {
                    return res.status(400).json({ message: "ยังไม่สามารถเช็คชื่อออกได้เนื่องจากกิจกรรมยังไม่เริ่ม" });
                } else {
                    return res.status(400).json({ message: `คุณได้ลงชื่อครบแล้ว ${imagesJson}` });
                }
            } else {
                return res.status(400).json({ message: `คุณได้ลงชื่อครบแล้ว ${imagesJson}` });
            }

        } else if (currentTime >= eventStart && currentTime <= eventEnd) {
            // During the event
            const diffAfterStart = currentTime.diff(eventStart, 'minutes').minutes;

            if (registrationResults.length === 0) {
                if (diffAfterStart <= 45) {
                    await connection.query(
                        "INSERT INTO registrations (event_id, customer_id, check_type, images, time_check) VALUES (?, ?, 'in', ?, ?)",
                        [eventId, customerId, imagesJson, currentTime.toISO()]
                    );
                    return res.status(201).json({ message: "เช็คชื่อเข้าร่วมกิจกรรมสำเร็จ" });
                } else {
                    return res.status(400).json({ message: `หมดเวลาลงชื่อเข้าร่วมกิจกรรมแล้ว` });
                }
            } else if (registrationResults.length === 1) {
                const lastReg = registrationResults[0];
                if (lastReg.check_type === 'in') {
                    await connection.query(
                        "INSERT INTO registrations (event_id, customer_id, check_type, images, time_check) VALUES (?, ?, 'out', ?, ?)",
                        [eventId, customerId, null, currentTime.toISO()]
                    );
                    return res.status(201).json({ message: "เช็คชื่อออกจากกิจกรรมสำเร็จ" });
                } else {
                    return res.status(400).json({ message: "ข้อมูลการลงชื่อไม่ถูกต้อง" });
                }
            } else {
                return res.status(400).json({ message: `คุณได้ลงชื่อครบแล้ว ${imagesJson}` });
            }

        } else {
            // After the event ends
            return res.status(400).json({ message: `หมดเวลาลงชื่อเข้าร่วมกิจกรรมแล้ว` });
        }

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
    const { customerId } = req.params;
    const currentPage = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.per_page) || 10;

    // Define timezone
    const TIMEZONE = 'Asia/Bangkok';

    // Validate customerId
    if (!customerId) {
        return res.status(400).json({ message: "กรุณาระบุ customerId" });
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

        // Query pagination with count of 'in' registrations
        const [countResults] = await connection.query(
            "SELECT COUNT(*) as total FROM registrations WHERE customer_id = ? AND check_type = 'in'",
            [customerId]
        );
        const totalRegistrations = countResults[0].total;
        const totalPages = Math.ceil(totalRegistrations / perPage);
        const offset = (currentPage - 1) * perPage;

        // ดึงรายการกิจกรรมที่ลูกค้าได้ลงทะเบียน (check_type = 'in' only) พร้อมเรียงลำดับจากล่าสุด
        const [eventResults] = await connection.query(
            `SELECT 
                e.id AS eventId,
                e.activityName,
                e.course,
                e.startDate,
                e.endDate,
                e.startTime,
                e.endTime,
                e.Nameplace,
                e.province,
                r_in.images AS registrationImages,   -- Alias for 'in' registration images
                r_in.time_check AS in_time,
                r_in.id AS in_registration_id,
                r_out.time_check AS out_time,
                r_out.id AS out_registration_id,
                r_out.images AS out_registrationImages,
                r_out.points AS pointsEarned
            FROM 
                event e 
            INNER JOIN 
                registrations r_in ON e.id = r_in.event_id 
                AND r_in.customer_id = ? 
                AND r_in.check_type = 'in'
            LEFT JOIN 
                registrations r_out ON e.id = r_out.event_id 
                AND r_out.customer_id = ? 
                AND r_out.check_type = 'out'
            WHERE 
                r_in.customer_id = ? 
                AND r_in.check_type = 'in'
            ORDER BY 
                r_in.time_check DESC
            LIMIT ? OFFSET ?`,
            [customerId, customerId, customerId, perPage, offset]
        );

        const formatEventDates = (event) => {
            // Parse startDate and endDate as Luxon DateTime objects
            const eventStartUTC = DateTime.fromISO(event.startDate.toISOString(), { zone: 'utc' });
            const eventEndUTC = DateTime.fromISO(event.endDate.toISOString(), { zone: 'utc' });

            // Extract hours, minutes, and seconds from startTime and endTime
            const [startHour, startMinute, startSecond] = event.startTime.split(':').map(Number);
            const [endHour, endMinute, endSecond] = event.endTime.split(':').map(Number);

            // Convert to Asia/Bangkok timezone and set the correct time
            const eventStart = eventStartUTC.setZone(TIMEZONE).set({
                hour: startHour,
                minute: startMinute,
                second: startSecond,
                millisecond: 0
            });

            const eventEnd = eventEndUTC.setZone(TIMEZONE).set({
                hour: endHour,
                minute: endMinute,
                second: endSecond,
                millisecond: 0
            });

            return {
                startDate: eventStart.toISODate(), // 'YYYY-MM-DD'
                endDate: eventEnd.toISODate(),
                startTime: eventStart.toFormat('HH:mm:ss'), // 'HH:mm:ss'
                endTime: eventEnd.toFormat('HH:mm:ss')
            };
        };

        await connection.beginTransaction();

        let totalPointsToAdd = 0;

        // Prepare events data with images and calculate points
        const eventsData = await Promise.all(eventResults.map(async (row) => {
            // Log the raw image strings for debugging
            console.log(`Event ID: ${row.eventId}`);
            console.log(`Registration Images (In): ${row.registrationImages}`);

            const formattedDates = formatEventDates(row);

            let points = 0;

            if (row.out_time) { // Removed row.in_time check
                const inTime = new Date(row.in_time);
                const outTime = new Date(row.out_time);

                const durationMilliseconds = outTime - inTime;
                const durationMinutes = durationMilliseconds / (1000 * 60); 

                console.log('ระยะเวลา (นาที):', inTime, outTime);

                if (durationMinutes > 0) { // ตรวจสอบว่า out_time มากกว่า in_time
                    points = Math.floor(durationMinutes / 30) * 5; // ทุก 30 นาที = 5 คะแนน

                    console.log(`Event ID: ${row.eventId} Duration: ${durationMinutes} minutes, Points: ${points}`);

                    // เพิ่มคะแนนรวม
                    totalPointsToAdd += points;

                    await connection.query(
                        "UPDATE registrations SET points_awarded = TRUE, points = ? WHERE id = ?",
                        [points, row.in_registration_id]
                    );

                } else {
                    console.log(`Event ID: ${row.eventId} has invalid time entries. Out time is before In time.`);
                }
            } else {
                if (!row.out_time) {
                    console.log(`Event ID: ${row.eventId} does not have an 'out' registration.`);
                }
            }

            return {
                eventId: row.eventId,
                activityName: row.activityName,
                course: row.course,
                startDate: formattedDates.startDate,
                endDate: formattedDates.endDate,
                startTime: formattedDates.startTime,
                endTime: formattedDates.endTime,
                Nameplace: row.Nameplace,
                province: row.province,
                status: row.registrationImages.length > 0 ? 'เข้าร่วมสำเร็จ' : 'ไม่สำเร็จ',
                registrationImages: row.registrationImages,
                pointsEarned: row.pointsEarned || points
            };
        }));

        // ดึง total_point ปัจจุบันจาก customerinfo
        const [totalPointResults] = await connection.query(
            "SELECT total_point FROM customerinfo WHERE customer_id = ?",
            [customerId]
        );
        const currentTotalPoint = totalPointResults[0].total_point || 0;

        // เช็คว่า total_point ปัจจุบันมากกว่า totalPointsToAdd หรือไม่
        if (currentTotalPoint > totalPointsToAdd) {
            // ถ้ามากกว่า ให้ใช้ totalPointsToAdd
            await connection.query(
                "UPDATE customerinfo SET total_point = ? WHERE customer_id = ?",
                [totalPointsToAdd, customerId]
            );

            console.log(`Set total_point to ${totalPointsToAdd} for customer ID: ${customerId}`);
        } else {
            // ถ้าน้อยกว่า หรือเท่ากัน ให้ใช้ totalPointsToAdd
            await connection.query(
                "UPDATE customerinfo SET total_point = ? WHERE customer_id = ?",
                [totalPointsToAdd, customerId]
            );

            console.log(`Set total_point to ${totalPointsToAdd} for customer ID: ${customerId}`);
        }

        await connection.commit();

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
            data: eventsData,
            totalPointsAdded: totalPointsToAdd
        });
    } catch (error) {
        console.error("Transaction Error:", error);
        await connection.rollback();
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const EditEvent = async (req, res) => {
    const { eventId } = req.params;
    const { event_type, latitude, longitude, province } = req.body;

    const isSuperAdmin = req.user.role === 'super_admin'; 

    // ตรวจสอบ event_type หากมีการส่งมา
    if (event_type && !['special', 'normal'].includes(event_type)) {
        return res.status(400).json({ message: 'Invalid event type' });
    }

    // ตรวจสอบ latitude และ longitude หากมีการส่งมา
    if (latitude !== undefined) {
        const lat = parseFloat(latitude);
        if (isNaN(lat) || lat < -90 || lat > 90) {
            return res.status(400).json({ message: 'Invalid latitude value' });
        }
    }

    if (longitude !== undefined) {
        const lng = parseFloat(longitude);
        if (isNaN(lng) || lng < -180 || lng > 180) {
            return res.status(400).json({ message: 'Invalid longitude value' });
        }
    }

    // ตรวจสอบ province หากมีการส่งมา
    if (province !== undefined && typeof province !== 'string') {
        return res.status(400).json({ message: 'Invalid province value' });
    }

    try {
        // ตรวจสอบว่ากิจกรรมมีอยู่ในฐานข้อมูลหรือไม่
        const [eventResults] = await connection.query(
            "SELECT * FROM event WHERE id = ?", [eventId]
        );

        if (eventResults.length === 0) {
            return res.status(404).json({ message: "Event not found" });
        }

        const event = eventResults[0];

        // ตรวจสอบสิทธิ์ในการแก้ไขกิจกรรม
        if (isSuperAdmin || event.event_type === event_type) {
            // สร้าง array ของค่าใหม่ที่จะอัปเดต
            const updateFields = [
                req.body.activityName,
                req.body.course,
                req.body.startDate,
                req.body.endDate,
                req.body.startTime,
                req.body.endTime,
                event_type || event.event_type
            ];

            // สร้าง query และ parameters สำหรับฟิลด์ที่อัปเดต
            let updateQuery = `
                UPDATE event 
                SET activityName = ?, course = ?, startDate = ?, endDate = ?, startTime = ?, endTime = ?, event_type = ?
            `;
            let queryParams = [...updateFields];

            // ถ้ามีการส่ง latitude, longitude, หรือ province มา ให้เพิ่มเข้าไปใน query
            if (latitude !== undefined) {
                updateQuery += `, latitude = ?`;
                queryParams.push(parseFloat(latitude));
            }

            if (longitude !== undefined) {
                updateQuery += `, longitude = ?`;
                queryParams.push(parseFloat(longitude));
            }

            if (province !== undefined) {
                updateQuery += `, province = ?`;
                queryParams.push(province);
            }

            // เพิ่มเงื่อนไข WHERE
            updateQuery += ` WHERE id = ?`;
            queryParams.push(eventId);

            // ทำการอัปเดตข้อมูลในฐานข้อมูล
            await connection.query(updateQuery, queryParams);

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