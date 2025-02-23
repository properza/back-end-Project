import pool from "../model/database.js";
import { DateTime } from 'luxon';

export const getEventWithCustomerCount = async (req, res) => {
    const { eventId } = req.params;
    const currentPage = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.per_page) || 10;

    try {
        const [countResults] = await pool.query(
            "SELECT COUNT(*) as total FROM registrations WHERE event_id = ?",
            [eventId]
        );
        const totalCustomers = countResults[0].total;
        const totalPages = Math.ceil(totalCustomers / perPage);
        const offset = (currentPage - 1) * perPage;

        const [eventResults] = await pool.query(
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

        const uniqueCustomerIds = new Set();

        const uniqueRows = eventResults.filter((row) => {
            if (!row.customer_id) return false;

            if (uniqueCustomerIds.has(row.customer_id)) {
                return false;
            }

            uniqueCustomerIds.add(row.customer_id);
            return true;
        });

        const listST = uniqueRows.map(row => {
            // Convert startDate, endDate, startTime, and endTime to Date objects for comparison
            const eventStartDate = new Date(row.startDate + 'T' + row.startTime);
            const eventEndDate = new Date(row.endDate + 'T' + row.endTime);
            const currentTime = new Date();

            // Calculate the total number of days the event spans (inclusive)
            const totalDays = Math.ceil((eventEndDate - eventStartDate) / (1000 * 3600 * 24)) + 1;

            let status = null;
            let participationStatus = "1/" + totalDays;

            const isMultipleDays = row.startDate !== row.endDate;

            if (row.check_type === 'in') {
                if (currentTime > eventEndDate) {
                    status = 'เข้าร่วมไม่สำเร็จ';
                } else if (currentTime >= eventStartDate && currentTime < eventEndDate) {
                    status = 'กำลังเข้าร่วม';
                }
            } else if (row.check_type === 'out') {
                if (isMultipleDays) {
                    // If event is on multiple days, mark as completed participation across the days
                    const eventDayStart = new Date(row.startDate + 'T' + row.startTime);
                    const eventDayEnd = new Date(row.endDate + 'T' + row.endTime);

                    // Calculate how many days the customer attended
                    let attendedDays = 0;
                    const checkOutDate = new Date(row.out_time);  // Assume out_time is provided in a compatible format

                    // Check if customer attended on specific days
                    if (checkOutDate >= eventDayStart && checkOutDate <= eventDayEnd) {
                        attendedDays = 1; // Customer attended this day
                    }

                    participationStatus = `${attendedDays}/${totalDays}`; // Update participation status
                } else {
                    participationStatus = "1/1"; // For single day events
                }
                status = 'เข้าร่วมสำเร็จ';
            }

            return {
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
                images: row.registrationImages,
                status: status + " " + participationStatus,
            };
        });

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
            listST: listST
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

const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371000; // รัศมีของโลกในเมตร
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
};

export const registerCustomerForEvent = async (req, res) => {
    const { eventId } = req.params;
    const { customerId, customerLatitude, customerLongitude } = req.body;

    if (!customerId) {
        return res.status(400).json({ message: "กรุณาระบุ customerId" });
    }

    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: "กรุณาอัปโหลดรูปภาพ" });
    }

    const imageUrls = req.files.map(file => file.location);  // เก็บ URL ของไฟล์

    try {
        // ตรวจสอบกิจกรรม
        const [eventResults] = await pool.query(
            "SELECT * FROM event WHERE id = ? AND admin_id IS NOT NULL",
            [eventId]
        );

        if (eventResults.length === 0) {
            return res.status(404).json({ message: "ไม่พบกิจกรรมหรือกิจกรรมไม่ได้ถูกสร้างโดย admin" });
        }

        const eventDetails = eventResults[0];
        const eventLatitude = eventDetails.latitude;
        const eventLongitude = eventDetails.longitude;

        const distance = calculateDistance(customerLatitude, customerLongitude, eventLatitude, eventLongitude);

        // ตรวจสอบระยะห่าง
        if (distance > 80) {
            return res.status(400).json({ message: "คุณอยู่นอกเขตพื้นที่กิจกรรม" });
        }

        const [customerResults] = await pool.query(
            "SELECT * FROM customerinfo WHERE customer_id = ?",
            [customerId]
        );

        if (customerResults.length === 0) {
            return res.status(404).json({ message: "ไม่พบข้อมูลผู้ใช้" });
        }

        const customerinfo = customerResults[0];

        // เปลี่ยนค่า st_tpye ของลูกค้า
        let customerType = "normal";
        if (customerinfo.st_tpye === "กยศ.") {
            customerType = "special";
        }

        // เปรียบเทียบ st_tpye ของลูกค้ากับ event_type ของกิจกรรม
        if (customerType !== eventDetails.event_type) {
            return res.status(400).json({ message: "ประเภทกิจกรรมไม่ตรงกับประเภทของผู้ใช้" });
        }

        const timezone = 'Asia/Bangkok';
        const currentTime = DateTime.now().setZone(timezone);

        const startDateTimeStr = eventDetails.startDate.toISOString();
        const endDateTimeStr = eventDetails.endDate.toISOString();

        // Parse event start and end times using Luxon
        const eventStartUTC = DateTime.fromISO(startDateTimeStr, { zone: 'utc' });
        const eventEndUTC = DateTime.fromISO(endDateTimeStr, { zone: 'utc' });

        // ตรวจสอบวันที่ให้แน่ใจว่าอยู่ในช่วงวันที่ของกิจกรรม
        if (currentTime < eventStartUTC || currentTime > eventEndUTC) {
            return res.status(400).json({ message: "ไม่อยู่ในช่วงวันที่ของกิจกรรม" });
        }

        const currentDate = currentTime.toISODate();

        //AND check_type = 'in'

        const [registrationResults] = await pool.query(
            "SELECT * FROM registrations WHERE event_id = ? AND customer_id = ? AND check_type = 'in' AND participation_day = ?",
            [eventId, customerId, currentDate]
        );

        // ตรวจสอบเวลาลงชื่อและออกในแต่ละวัน
        const [startHour, startMinute] = eventDetails.startTime.split(':').map(Number);
        const [endHour, endMinute] = eventDetails.endTime.split(':').map(Number);

        const eventStart = eventStartUTC.setZone(timezone).set({ hour: startHour, minute: startMinute });
        const eventEnd = eventEndUTC.setZone(timezone).set({ hour: endHour, minute: endMinute });

        const inTime = DateTime.fromISO(registrationResults.time_check, { zone: 'utc' }).setZone(timezone)
        const outTime = DateTime.fromISO(currentTime.toISO()).setZone(timezone)

        // Logic การลงทะเบียน
        if (registrationResults.length === 0) {
            if (currentTime >= eventStart && currentTime <= eventEnd) {
                await pool.query(
                    "INSERT INTO registrations (event_id, customer_id, check_type, images, time_check, participation_day) VALUES (?, ?, 'in', ?, ?, ?)",
                    [eventId, customerId, JSON.stringify(imageUrls), currentTime.toISO(), currentDate]
                );
                return res.status(201).json({ message: "เช็คชื่อเข้าร่วมกิจกรรมสำเร็จ" });
            } else {
                return res.status(400).json({ message: `หมดเวลาลงชื่อเข้าร่วมกิจกรรมแล้ว` });
            }
        } else {
            const lastReg = registrationResults[0];
            if (lastReg.check_type === 'in') {
                // คำนวณเวลาลงชื่อและออกในวันนั้น ๆ
                

                console.log(lastReg);
                console.log("inTime:", inTime.toISO(), "outTime:", outTime.toISO());

                // คำนวณระยะเวลาที่ลูกค้าเข้าร่วมกิจกรรม
                const durationMilliseconds = outTime - inTime;
                const durationMinutes = durationMilliseconds / (1000 * 60);
                const points = Math.floor(durationMinutes / 60);

                // ตรวจสอบว่า lastReg ยังมีอยู่ก่อนทำการเพิ่มข้อมูล 'out'
                if (!lastReg) {
                    return res.status(400).json({ message: "ข้อมูลการลงชื่อไม่ถูกต้อง" });
                }

                // เพิ่มข้อมูลการลงชื่อออก (INSERT)
                await pool.query(
                    "INSERT INTO registrations (event_id, customer_id, check_type, images, time_check, participation_day) VALUES (?, ?, 'out', ?, ?, ?)",
                    [eventId, customerId, null, currentTime.toISO(), currentDate]
                );

                // อัพเดทข้อมูลการลงชื่อออก (UPDATE)
                await pool.query(
                    "UPDATE registrations SET points_awarded = TRUE, points = ? WHERE id = ?",
                    [points, lastReg.id]
                );

                return res.status(201).json({ message: "เช็คชื่อออกจากกิจกรรมสำเร็จ", points: points });
            } else {
                return res.status(400).json({ message: "ข้อมูลการลงชื่อไม่ถูกต้อง" });
            }

        }

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Internal server error" });
    }
};


export const getRegisteredEventsForCustomer = async (req, res) => {
    const { customerId } = req.params; // รับ customerId จาก URL params
    const currentPage = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.per_page) || 10;

    // กำหนดเขตเวลา
    const TIMEZONE = 'Asia/Bangkok';

    if (!customerId) {
        return res.status(400).json({ message: "กรุณาระบุ customerId ใน URL" });
    }

    let connection;
    try {
        connection = await pool.getConnection();

        await connection.beginTransaction();

        const [customerResults] = await connection.query(
            "SELECT * FROM customerinfo WHERE customer_id = ?",
            [customerId]
        );

        if (customerResults.length === 0) {
            return res.status(404).json({ message: "Customer not found" });
        }

        // ค้นหาจำนวนการลงทะเบียน (check_type = 'in')
        const [countResults] = await connection.query(
            "SELECT COUNT(*) as total FROM registrations WHERE customer_id = ? AND check_type = 'in'",
            [customerId]
        );
        const totalRegistrations = countResults[0].total;
        const totalPages = Math.ceil(totalRegistrations / perPage);
        const offset = (currentPage - 1) * perPage;

        // ดึงข้อมูลกิจกรรมที่ลูกค้าลงทะเบียน
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
                e.latitude,    
                e.longitude,    
                r_in.images AS registrationImages,   
                r_in.time_check AS in_time,
                r_in.id AS in_registration_id,
                r_out.time_check AS out_time,
                r_out.id AS out_registration_id,
                r_out.images AS out_registrationImages,
                r_in.points AS pointsEarned
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
            const eventStartUTC = DateTime.fromISO(event.startDate.toISOString(), { zone: 'utc' });
            const eventEndUTC = DateTime.fromISO(event.endDate.toISOString(), { zone: 'utc' });

            const [startHour, startMinute, startSecond] = event.startTime.split(':').map(Number);
            const [endHour, endMinute, endSecond] = event.endTime.split(':').map(Number);

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

        let totalPointsToAdd = 0;

        const eventsData = await Promise.all(eventResults.map(async (row) => {
            const formattedDates = formatEventDates(row);

            let status = '';
            let participationStatus = "1/1"; // ค่าเริ่มต้นสำหรับการเข้าร่วมไม่ครบ (1 วัน จากทั้งหมด 1 วัน)

            const eventStartDate = new Date(row.startDate + 'T' + row.startTime);
            const eventEndDate = new Date(row.endDate + 'T' + row.endTime);

            // คำนวณจำนวนวันทั้งหมดที่กิจกรรมจัดขึ้น (รวมทั้งวันเริ่มต้นและวันสิ้นสุด)
            const totalEventDays = Math.ceil((eventEndDate - eventStartDate) / (1000 * 3600 * 24)) + 1;

            let attendedDays = 0;

            // เช็คสถานะการเข้าร่วมของลูกค้า
            if (row.in_registration_id) {
                const currentTime = new Date();
                if (currentTime > eventEndDate && !row.out_time) {
                    status = 'เข้าร่วมไม่สำเร็จ'; // ยังไม่สำเร็จ
                } else {
                    status = 'กำลังเข้าร่วม'; // กำลังเข้าร่วม
                }
            }

            // ถ้ามีการลงทะเบียน 'out' ให้ถือว่าเข้าร่วมสำเร็จและคำนวณวันที่เข้าร่วม
            if (row.out_registration_id) {
                status = 'เข้าร่วมสำเร็จแล้ว'; // เข้าร่วมสำเร็จแล้ว
                const inTime = new Date(row.in_time);
                const outTime = new Date(row.out_time);

                if (outTime >= eventStartDate && outTime <= eventEndDate) {
                    attendedDays = 1; // ลูกค้าเข้าร่วมกิจกรรมในวันนี้
                }

                participationStatus = `${attendedDays}/${totalEventDays}`; // แสดงสถานะการเข้าร่วมเป็น "X/Y"
            }

            // ถ้าลูกค้าร่วมครบทุกวัน (จำนวนวันเข้าร่วมเท่ากับจำนวนวันที่กิจกรรมจัดขึ้น)
            if (attendedDays === totalEventDays) {
                status = `เข้าร่วมสำเร็จแล้ว ${participationStatus}`; // เข้าร่วมครบทั้งกิจกรรม
            }

            // คำนวณระยะเวลาและคะแนน
            // if (row.in_registration_id && row.out_registration_id) {
            //     const inTime = new Date(row.in_time);
            //     const outTime = new Date(row.out_time);

            //     const durationMilliseconds = outTime - inTime;
            //     const durationHours = durationMilliseconds / (1000 * 3600); // แปลงเป็นชั่วโมง

            //     // คำนวณคะแนนจากระยะเวลาที่เข้าร่วม
            //     const points = Math.floor(durationHours); // 1 ชั่วโมง = 1 คะแนน
            //     totalPointsToAdd += points;

            //     // อัปเดตคะแนนในฐานข้อมูล
            //     await connection.query(
            //         "UPDATE registrations SET points_awarded = TRUE, points = ? WHERE id = ?",
            //         [points, row.in_registration_id]
            //     );
            // }

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
                latitude: row.latitude,
                longitude: row.longitude,
                status: status,  // แสดงสถานะร่วมกิจกรรม
                registrationImages: row.registrationImages,
                pointsEarned: row.pointsEarned || 0
            };
        }));

        // อัปเดตคะแนนทั้งหมดของลูกค้า
        const [totalPointResults] = await connection.query(
            "SELECT total_point FROM customerinfo WHERE customer_id = ?",
            [customerId]
        );
        const currentTotalPoint = totalPointResults[0].total_point || 0;

        // อัปเดตคะแนนลูกค้าในฐานข้อมูล
        await connection.query(
            "UPDATE customerinfo SET total_point = ? WHERE customer_id = ?",
            [Math.max(totalPointsToAdd, currentTotalPoint), customerId]
        );

        await connection.commit();

        const meta = {
            total: totalRegistrations,
            per_page: perPage,
            current_page: currentPage,
            last_page: totalPages
        };

        return res.status(200).json({
            meta: meta,
            data: eventsData,
            totalPointsAdded: totalPointsToAdd
        });
    } catch (error) {
        console.error("Transaction Error:", error);

        // Rollback ในกรณีที่เกิดข้อผิดพลาด
        if (connection) {
            await connection.rollback();
        }

        return res.status(500).json({ message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" });
    } finally {
        // ปล่อยการเชื่อมต่อ
        if (connection) {
            connection.release();
        }
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
        const [eventResults] = await pool.query(
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
            await pool.query(updateQuery, queryParams);

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
        const [eventResults] = await pool.query(
            "SELECT * FROM event WHERE id = ?", [eventId]
        );

        if (eventResults.length === 0) {
            return res.status(404).json({ message: "Event not found" });
        }

        const event = eventResults[0];

        if (isSuperAdmin || event.event_type === event_type) {
            await pool.query("DELETE FROM event WHERE id = ?", [eventId]);

            return res.status(200).json({ message: 'Event deleted successfully' });
        } else {
            return res.status(403).json({ message: 'You do not have permission to delete this event' });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const getAllCloudEvents = async (req, res) => {
    let currentPage = parseInt(req.query.page) || 1;  // หน้าแรก (default = 1)
    let perPage = parseInt(req.query.per_page) || 10;  // จำนวนข้อมูลต่อหน้า (default = 10)

    if (isNaN(currentPage) || currentPage < 1) {
        return res.status(400).json({ message: 'Invalid page number' });
    }

    if (isNaN(perPage) || perPage < 1) {
        return res.status(400).json({ message: 'Invalid per_page number' });
    }

    const offset = (currentPage - 1) * perPage;

    try {
        // คำนวณจำนวนทั้งหมด (total records)
        const countQuery = "SELECT COUNT(*) AS total FROM cloud";
        const [countResults] = await pool.query(countQuery);
        const totalRecords = countResults[0].total;
        const totalPages = Math.ceil(totalRecords / perPage);

        // สร้าง URL สำหรับการคำนวณหน้าต่าง ๆ
        const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl}${req.path}`;
        const constructUrl = (page) => {
            const params = new URLSearchParams(req.query);
            params.set('page', page);
            params.set('per_page', perPage);
            return `${baseUrl}?${params.toString()}`;
        };

        // ดึงข้อมูลจากตาราง cloud
        const query = `
            SELECT * FROM cloud 
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `;
        const [eventsResults] = await pool.query(query, [perPage, offset]);

        // สร้างข้อมูล meta สำหรับ pagination
        const meta = {
            total: totalRecords,
            per_page: perPage,
            current_page: currentPage,
            last_page: totalPages,
            first_page: 1,
            first_page_url: constructUrl(1),
            last_page_url: constructUrl(totalPages),
            next_page_url: currentPage < totalPages ? constructUrl(currentPage + 1) : null,
            previous_page_url: currentPage > 1 ? constructUrl(currentPage - 1) : null
        };

        // ส่งข้อมูลให้ผู้ใช้
        return res.status(200).json({
            meta: meta,
            data: eventsResults
        });

    } catch (error) {
        console.error("Error fetching all cloud events:", error);
        return res.status(500).json({ message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" });
    }
};
