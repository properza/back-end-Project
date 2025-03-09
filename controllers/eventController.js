import pool from "../model/database.js";
import { DateTime } from 'luxon';

export const getEventWithCustomerCount = async (req, res) => {
    const { eventId } = req.params;
    const currentPage = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.per_page) || 10;

    try {
        // 1) นับจำนวนแถวทั้งหมดใน registrations เพื่อใช้ทำ pagination
        const [countResults] = await pool.query(
            "SELECT COUNT(*) as total FROM registrations WHERE event_id = ?",
            [eventId]
        );
        const totalCustomers = countResults[0].total;  // **หมายเหตุ**: นี่คือยอดรวม "แถว" ไม่ใช่ยอดรวม "คน" จริง
        const totalPages = Math.ceil(totalCustomers / perPage);
        const offset = (currentPage - 1) * perPage;

        // 2) ดึงข้อมูล (limited) จากตาราง event, registrations และ customerinfo
        const [eventResults] = await pool.query(
            `SELECT e.*,
                    r.check_type,
                    r.time_check,
                    r.images AS registrationImages,
                    r.customer_id,
                    c.name,
                    c.picture,
                    c.email,
                    c.first_name,
                    c.last_name,
                    c.user_code,
                    c.group_st,
                    c.branch_st,
                    c.tpye_st,
                    c.st_tpye,
                    c.total_point,
                    c.faceUrl,
                    c.levelST
             FROM event e
             LEFT JOIN registrations r ON e.id = r.event_id
             LEFT JOIN customerinfo c ON r.customer_id = c.customer_id
             WHERE e.id = ?
             ORDER BY r.customer_id, r.time_check
             LIMIT ? OFFSET ?`,
            [eventId, perPage, offset]
        );

        // กรณีไม่พบ event ในตาราง
        if (eventResults.length === 0) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // 3) จัดกลุ่มข้อมูลด้วย Map ตาม customer_id
        //    เพื่อคำนวณชั่วโมง-นาทีที่เข้าร่วม
        const firstRow = eventResults[0];
        const endDateObj = new Date(firstRow.endDate); // ได้ date (เฉพาะวัน)
        // แยก HH:mm
        const [endH, endM] = firstRow.endTime.split(':').map(Number);
        endDateObj.setHours(endH);
        endDateObj.setMinutes(endM);
        endDateObj.setSeconds(0);
        endDateObj.setMilliseconds(0);
        const userMap = new Map();

        for (const row of eventResults) {
            // ถ้าไม่มี customer_id แปลว่าหรือ row นั้นว่าง ก็ข้าม
            if (!row.customer_id) continue;

            // ถ้ายังไม่มี key = customer_id ใน Map ให้ตั้ง object ใหม่
            if (!userMap.has(row.customer_id)) {
                userMap.set(row.customer_id, {
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
                    // เอาไว้เก็บ registration ทุกรายการของลูกค้าคนนี้
                    registrations: [],
                });
            }
            // เก็บข้อมูลแถว (row) นี้ใส่ใน registrations ของ user คนนี้
            userMap.get(row.customer_id).registrations.push(row);
        }

        // 4) ประมวลผลรวมเวลาที่ลูกค้าเข้าร่วม จาก (in -> out)
        //    พร้อมกำหนด status ตามท้าย (in = กำลังเข้าร่วม, out = เข้าร่วมสำเร็จ)
        for (const [custId, userObj] of userMap) {
            const regs = userObj.registrations;
            // เรียงตามเวลา time_check (ascending) ถ้ายังไม่ได้ sorting มาก่อน
            regs.sort((a, b) => new Date(a.time_check) - new Date(b.time_check));

            let totalDurationMs = 0;   // เก็บเวลาสะสม (ms)
            let lastInTime = null;     // เก็บเวลา in ล่าสุด (Date object)
            let finalStatus = null;    // สถานะสุดท้าย (in หรือ out)

            // วนดูทุก registration ของผู้ใช้
            for (const reg of regs) {
                if (reg.check_type === 'in') {
                    // ถ้าเจอ in ให้จดเวลา
                    lastInTime = new Date(reg.time_check);
                    finalStatus = 'กำลังเข้าร่วม';
                } else if (reg.check_type === 'out') {
                    // ถ้าเจอ out และมี lastInTime => นำมาคำนวณเวลาที่อยู่
                    if (lastInTime) {
                        const outTime = new Date(reg.time_check);
                        const diffMs = outTime - lastInTime;
                        if (diffMs > 0) {
                            totalDurationMs += diffMs;
                        }
                        lastInTime = null; // เคลียร์ lastInTime เมื่อ out แล้ว
                    }
                    finalStatus = 'เข้าร่วมสำเร็จ';
                }
            }

            if (finalStatus === 'กำลังเข้าร่วม') {
                const now = new Date();
                if (now > endDateObj) {
                    finalStatus = 'เข้าร่วมไม่สำเร็จ';
                }
            }

            // คำนวณเป็นชม.นาที
            const totalHours = Math.floor(totalDurationMs / (1000 * 60 * 60));
            const totalMinutes = Math.floor((totalDurationMs % (1000 * 60 * 60)) / (1000 * 60));
            const participationTime = `${totalHours} ชม. ${totalMinutes} นาที`;

            // ใส่ค่าใน userObj (เดี๋ยวจะนำไปสร้าง listST อีกที)
            userObj.participationTime = participationTime;
            userObj.status = finalStatus;
        }

        // 5) สร้าง listST เพื่อใส่ข้อมูลผู้ใช้แต่ละคนไปใน array
        const listST = Array.from(userMap.values()).map((u) => ({
            id: u.customer_id,
            customer_id: u.customer_id,
            name: u.name,
            picture: u.picture,
            email: u.email,
            first_name: u.first_name,
            last_name: u.last_name,
            user_code: u.user_code,
            group_st: u.group_st,
            branch_st: u.branch_st,
            tpye_st: u.tpye_st,
            st_tpye: u.st_tpye,
            total_point: u.total_point,
            faceUrl: u.faceUrl,
            levelST: u.levelST,
            participationTime: u.participationTime,
            status: u.status,
        }));

        // 6) เตรียมข้อมูล event เพื่อตอบกลับ
         // หยิบแถวแรกไว้เป็นข้อมูล event
        const eventData = {
            id: firstRow.id,
            activityName: firstRow.activityName,
            course: firstRow.course,
            startDate: firstRow.startDate,
            endDate: firstRow.endDate,
            startTime: firstRow.startTime,
            endTime: firstRow.endTime,
            Nameplace: firstRow.Nameplace,
            latitude: firstRow.latitude,
            longitude: firstRow.longitude,
            province: firstRow.province,
            admin_id: firstRow.admin_id,
            event_type: firstRow.event_type,
            created_at: firstRow.created_at,
            listST: listST,
        };

        // 7) สร้าง meta pagination
        const meta = {
            total: totalCustomers,
            per_page: perPage,
            current_page: currentPage,
            last_page: totalPages,
        };

        // 8) ส่งผลลัพธ์กลับ
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
    const { customerId, customerLatitude, customerLongitude, check } = req.body;

    // ตรวจสอบว่ามีค่า customerId หรือไม่
    if (!customerId) {
        return res.status(400).json({ message: "กรุณาระบุ customerId" });
    }

    // ตรวจสอบว่ามีการอัปโหลดไฟล์รูปภาพหรือไม่
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: "กรุณาอัปโหลดรูปภาพ" });
    }

    // เก็บ URL ของไฟล์รูปภาพ
    const imageUrls = req.files.map(file => file.location);

    // ตรวจสอบค่า check ว่ามีการส่งมาไหม และต้องเป็น "in" หรือ "out" เท่านั้น
    if (!check || (check !== 'in' && check !== 'out')) {
        return res.status(400).json({ message: "กรุณาระบุ check เป็น 'in' หรือ 'out'" });
    }

    try {
        // 1. ตรวจสอบข้อมูลกิจกรรม
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

        // 2. ตรวจสอบระยะห่างจากกิจกรรม
        const distance = calculateDistance(customerLatitude, customerLongitude, eventLatitude, eventLongitude);
        if (distance > 80) {
            return res.status(400).json({ message: "คุณอยู่นอกเขตพื้นที่กิจกรรม" });
        }

        // 3. ตรวจสอบว่ามี customer หรือไม่
        const [customerResults] = await pool.query(
            "SELECT * FROM customerinfo WHERE customer_id = ?",
            [customerId]
        );
        if (customerResults.length === 0) {
            return res.status(404).json({ message: "ไม่พบข้อมูลผู้ใช้" });
        }
        const customerinfo = customerResults[0];

        // 4. ตรวจสอบประเภทของลูกค้ากับประเภทของกิจกรรม
        let customerType = "normal";
        if (customerinfo.st_tpye === "กยศ.") {
            customerType = "special";
        }
        if (eventDetails.event_type === "special" && customerType !== "special") {
            return res.status(400).json({ message: "ประเภทกิจกรรมไม่ตรงกับประเภทของผู้ใช้" });
        }

        // 5. ตรวจสอบช่วงเวลาที่สามารถเช็คได้ (เช็ค in/out)
        const timezone = 'Asia/Bangkok';
        const currentTime = DateTime.now().setZone(timezone);

        // เวลากิจกรรม (UTC) -> แปลงเป็น Asia/Bangkok แล้วนำมาเทียบ
        const eventStartUTC = DateTime.fromJSDate(eventDetails.startDate, { zone: 'utc' });
        const eventEndUTC = DateTime.fromJSDate(eventDetails.endDate, { zone: 'utc' });

        // eventDetails.startTime, eventDetails.endTime สมมติเป็น string รูปแบบ "HH:mm"
        const [startHour, startMinute] = eventDetails.startTime.split(':').map(Number);
        const [endHour, endMinute] = eventDetails.endTime.split(':').map(Number);

        const eventStart = eventStartUTC.setZone(timezone).set({ hour: startHour, minute: startMinute });
        const eventEnd = eventEndUTC.setZone(timezone).set({ hour: endHour, minute: endMinute });

        // อนุญาตให้เช็คชื่อได้ล่วงหน้า 15 นาที
        const earlyStartTime = eventStart.minus({ minutes: 15 });
        if (currentTime < earlyStartTime) {
            return res.status(400).json({ message: "ไม่อยู่ในช่วงเวลาลงทะเบียนกิจกรรม" });
        } else if (currentTime > eventEnd) {
            return res.status(400).json({ message: "หมดเวลาลงทะเบียนกิจกรรมแล้ว" });
        }

        // 6. ตรวจสอบการลงทะเบียนในตาราง registrations เฉพาะวันเดียวกัน
        const currentDate = currentTime.toISODate();
        const [registrationResults] = await pool.query(
            "SELECT * FROM registrations WHERE event_id = ? AND customer_id = ? AND participation_day = ?",
            [eventId, customerId, currentDate]
        );

        // คำนวณ "ระยะเวลาทั้งหมดของกิจกรรม" (หน่วยชั่วโมง) ในวันนั้น
        const totalDurationHours = eventEnd.diff(eventStart, 'hours').hours;

        // 7. แยกตรรกะตามค่า check (in / out)
        if (check === 'in') {
            // ตรวจสอบว่ามีการเช็ค in ไปแล้วหรือยัง
            const existingIn = registrationResults.find(reg => reg.check_type === 'in');
            if (existingIn) {
                return res.status(400).json({ message: "ท่านได้ลงชื่อเข้าร่วมกิจกรรมไปแล้ว" });
            }

            // ถ้ายังไม่มี in ให้เพิ่มเป็น in
            await pool.query(
                `INSERT INTO registrations 
                    (event_id, customer_id, check_type, images, time_check, participation_day) 
                 VALUES (?, ?, 'in', ?, ?, ?)`,
                [eventId, customerId, JSON.stringify(imageUrls), new Date(currentTime), currentDate]
            );

            return res.status(201).json({ message: "เช็คชื่อเข้าร่วมกิจกรรมสำเร็จ" });

        } else if (check === 'out') {
            // ตรวจสอบว่ามีการเช็ค out ไปแล้วหรือยัง
            const existingOut = registrationResults.find(reg => reg.check_type === 'out');
            if (existingOut) {
                return res.status(400).json({ message: "ท่านได้ลงชื่อออกจากกิจกรรมไปแล้ว" });
            }

            // ต้องมี in ก่อน ถึงจะ out ได้
            const existingIn = registrationResults.find(reg => reg.check_type === 'in');
            if (!existingIn) {
                return res.status(400).json({ message: "ยังไม่ได้ลงชื่อเข้าร่วม (in) จึงไม่สามารถลงชื่อออกได้" });
            }

            // คำนวณระยะเวลาที่ผู้ใช้เข้าร่วมจริง (timeIn -> currentTime)
            const timeInString = existingIn.time_check; // จากฟิลด์ time_check ในฐานข้อมูล
            // const timeIn = DateTime.fromJSDate(timeInString).setZone(timezone);
            // const timeOut = currentTime;

            const points = Math.floor(totalDurationHours);

            // อัปเดตคะแนน
            await pool.query(
                "UPDATE customerinfo SET total_point = total_point + ? WHERE customer_id = ?",
                [points, customerId]
            );

            console.log(points)

            // บันทึกการเช็ค out
            await pool.query(
                `INSERT INTO registrations 
                    (event_id, customer_id, check_type, images, time_check, participation_day, points_awarded)
                 VALUES (?, ?, 'out', ?, ?, ?, FALSE)`,
                [eventId, customerId, JSON.stringify(imageUrls), new Date(currentTime), currentDate]
            );

            return res.status(201).json({ message: "เช็คชื่อออกจากกิจกรรมสำเร็จ" });
        }

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const getRegisteredEventsForCustomer = async (req, res) => {
    const { customerId } = req.params;
    const currentPage = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.per_page) || 10;
    const TIMEZONE = 'Asia/Bangkok';

    if (!customerId) {
        return res.status(400).json({ message: "กรุณาระบุ customerId ใน URL" });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // ตรวจสอบว่ามี customer หรือไม่
        const [customerResults] = await connection.query(
            "SELECT * FROM customerinfo WHERE customer_id = ?",
            [customerId]
        );
        if (customerResults.length === 0) {
            return res.status(404).json({ message: "Customer not found" });
        }

        // หาจำนวนการลงทะเบียน (check_type = 'in')
        const [countResults] = await connection.query(
            "SELECT COUNT(*) as total FROM registrations WHERE customer_id = ? AND check_type = 'in'",
            [customerId]
        );
        const totalRegistrations = countResults[0].total;
        const totalPages = Math.ceil(totalRegistrations / perPage);
        const offset = (currentPage - 1) * perPage;

        // ดึงข้อมูลกิจกรรมที่ลูกค้าลงทะเบียน (เฉพาะแถวที่ check_type = 'in')
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
                
                -- ข้อมูลการเช็คอิน
                r_in.images AS registrationImages,   
                r_in.time_check AS in_time,
                r_in.id AS in_registration_id,
                r_in.points AS pointsEarned,
                
                -- ข้อมูลการเช็คเอาต์ (ถ้ามี)
                r_out.time_check AS out_time,
                r_out.id AS out_registration_id,
                r_out.images AS out_registrationImages

            FROM event e
            INNER JOIN registrations r_in
                ON e.id = r_in.event_id
                AND r_in.customer_id = ?
                AND r_in.check_type = 'in'
            LEFT JOIN registrations r_out
                ON e.id = r_out.event_id
                AND r_out.customer_id = ?
                AND r_out.check_type = 'out'
            WHERE r_in.customer_id = ?
            ORDER BY r_in.time_check DESC
            LIMIT ? OFFSET ?`,
            [customerId, customerId, customerId, perPage, offset]
        );

        // ฟังก์ชันแปลง start/end ของกิจกรรม -> DateTime
        const parseEventDateTime = (row) => {
            const eventStartUTC = DateTime.fromJSDate(row.startDate, { zone: 'utc' });
            const eventEndUTC = DateTime.fromJSDate(row.endDate, { zone: 'utc' });

            const [startH, startM, startS] = row.startTime.split(':').map(Number);
            const [endH, endM, endS] = row.endTime.split(':').map(Number);

            const eventStart = eventStartUTC.setZone(TIMEZONE).set({
                hour: startH,
                minute: startM,
                second: startS || 0,
                millisecond: 0
            });

            const eventEnd = eventEndUTC.setZone(TIMEZONE).set({
                hour: endH,
                minute: endM,
                second: endS || 0,
                millisecond: 0
            });

            return { eventStart, eventEnd };
        };

        // ตัวแปรสะสม "นาทีทั้งหมด" ของ activityDurationString (เฉพาะกิจกรรมที่ผู้ใช้ out)
        let totalActivityMinutes = 0;

        const eventsData = await Promise.all(
            eventResults.map(async (row) => {
                // 1) คำนวณ "ระยะเวลากิจกรรม" (startTime→endTime)
                const { eventStart, eventEnd } = parseEventDateTime(row);
                const durationEventMs = eventEnd.toMillis() - eventStart.toMillis();

                let activityDurationString = "0 ชม. 0 นาที";
                if (durationEventMs > 0) {
                    const totalEventMinutes = Math.floor(durationEventMs / 60000);
                    const eventHours = Math.floor(totalEventMinutes / 60);
                    const eventMinutes = totalEventMinutes % 60;
                    activityDurationString = `${eventHours} ชม. ${eventMinutes} นาที`;
                }

                // 2) คำนวณเวลาที่ผู้ใช้เข้าร่วมจริง (in→out)
                let joinedDurationString = "0 ชม. 0 นาที";
                let status = "";
                const now = DateTime.now().setZone(TIMEZONE);

                if (!row.out_time) {
                    // ยังไม่มี out
                    if (now > eventEnd) {
                        status = "เข้าร่วมไม่สำเร็จ (เลยเวลางานแล้วแต่ไม่มี out)";
                    } else {
                        status = "กำลังเข้าร่วม";
                    }
                } else {
                    // ผู้ใช้เช็คออกแล้ว => ดูว่าเป็นวันเดียวกันหรือไม่
                    const inTime = DateTime.fromJSDate(row.in_time).setZone(TIMEZONE);
                    const outTime = DateTime.fromJSDate(row.out_time).setZone(TIMEZONE);

                    const inDay = inTime.toISODate();
                    const outDay = outTime.toISODate();

                    if (inDay === outDay) {
                        // คำนวณเวลาที่อยู่จริง
                        const durationMs = outTime.toMillis() - inTime.toMillis();
                        if (durationMs > 0) {
                            const totalJoinedMinutes = Math.floor(durationMs / 60000);
                            const joinedHours = Math.floor(totalJoinedMinutes / 60);
                            const joinedMinutes = totalJoinedMinutes % 60;

                            joinedDurationString = `${joinedHours} ชม. ${joinedMinutes} นาที`;

                            // สมมุติว่าคะแนน = durationHours ปัดลง
                            const durationHours = durationMs / (1000 * 3600);
                            const points = Math.floor(durationHours);

                            // update ลง DB ถ้าต้องการ
                            await connection.query(
                                "UPDATE registrations SET points_awarded = TRUE, points = ? WHERE id = ? AND check_type = 'in' AND DATE(time_check) = ?",
                                [points, row.in_registration_id, inDay]
                            );

                            status = "เข้าร่วมสำเร็จ";

                            // ---- จุดสำคัญ ----
                            // ถ้าผู้ใช้ out สำเร็จ => เอา "ระยะเวลากิจกรรม" มาบวกเข้ากับ totalActivityMinutes
                            // (เพราะเราต้องการสรุป "ชม. กิจกรรมทั้งหมด" ที่ผู้ใช้เช็คออก)
                            if (durationEventMs > 0) {
                                const sumEventMinutes = Math.floor(durationEventMs / 60000);
                                totalActivityMinutes += sumEventMinutes;
                            }

                        } else {
                            status = "เข้าร่วมไม่สำเร็จ (out <= in)";
                        }
                    } else {
                        status = "เข้าร่วมหลายวัน (ข้ามวัน)";
                    }
                }

                // 3) แปลง startDate, endDate, startTime, endTime ไว้แสดง
                const startDate = eventStart.toISODate();
                const endDate = eventEnd.toISODate();
                const startTime = eventStart.toFormat("HH:mm:ss");
                const endTime = eventEnd.toFormat("HH:mm:ss");

                return {
                    eventId: row.eventId,
                    activityName: row.activityName,
                    course: row.course,
                    startDate,
                    endDate,
                    startTime,
                    endTime,
                    Nameplace: row.Nameplace,
                    province: row.province,
                    latitude: row.latitude,
                    longitude: row.longitude,
                    activityDurationString,
                    joinedDurationString,
                    status,
                    registrationImages: row.registrationImages,
                    outRegistrationImages: row.out_registrationImages,
                    pointsEarned: row.pointsEarned || 0,
                };
            })
        );

        // คอมมิตการอัปเดตใน DB
        await connection.commit();

        // สรุป totalPointsAdded = ผลบวกของทุก activityDuration (ในนาที) → แปลงเป็น ชม./นาที
        const sumHours = Math.floor(totalActivityMinutes / 60);
        const sumMinutes = totalActivityMinutes % 60;
        const totalPointsAdded = `${sumHours} ชม. ${sumMinutes} นาที`;

        // ลบกิจกรรมซ้ำ (ถ้า 1 event => 1 แถว)
        const uniqueEvents = [];
        const seenEventIds = new Set();
        for (const e of eventsData) {
            if (!seenEventIds.has(e.eventId)) {
                seenEventIds.add(e.eventId);
                uniqueEvents.push(e);
            }
        }

        return res.status(200).json({
            meta: {
                total: totalRegistrations,
                per_page: perPage,
                current_page: currentPage,
                last_page: totalPages
            },
            data: uniqueEvents,
            // totalPointsAdded = รวม activityDurationString (เป็น ชม./นาที) ของทุกกิจกรรมที่ผู้ใช้ out
            totalPointsAdded
        });

    } catch (error) {
        console.error("Transaction Error:", error);
        if (connection) {
            await connection.rollback();
        }
        return res.status(500).json({ message: "Internal server error" });
    } finally {
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
