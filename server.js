import dotenv from "dotenv";
dotenv.config();
import express from "express";
import nodemailer from "nodemailer";
import cors from "cors";

// ✅ Prisma
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// PDF
import fs from "fs";
import PDFDocument from "pdfkit";

const app = express();

// CORS
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"],
}));

app.use(express.json());

// Gmail transporter
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Verify email
transporter.verify((error) => {
  if (error) {
    console.error("❌ Email transporter error:", error);
  } else {
    console.log("✅ Email server is ready");
  }
});

// Format date
function formatDate(dateString) {
  if (!dateString) return "Not provided";

  const date = new Date(dateString);

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Test route
app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

// =========================
// 📧 SEND EMAIL + SAVE DATA
// =========================
app.post("/send-email", async (req, res) => {

  const {
    doctorEmail,
    doctorName,
    date,
    message,

    occupation,

    height,
    weight,
    pulseRate,
    bloodPressure,
    temperature,

    pastIllness,
    medications,
    allergies,
    smoker,
    alcoholUse,

    familyHypertension,
    familyDiabetes,

    symptoms,

    firstName,
    middleName,
    lastName,
    age,
    address,
    contact,
    motherName,
    gender,
  } = req.body;

  if (!doctorEmail) {
    return res.status(400).json({ error: "doctorEmail is required" });
  }

  try {

    // ✅ URTI DETECTION
    const urtiSymptoms = [
      "Runny nose",
      "Sore throat",
      "Sneezing",
      "Mild cough",
      "Fever",
    ];

    const hasURTI =
      Array.isArray(symptoms) &&
      symptoms.filter(s => urtiSymptoms.includes(s)).length >= 2;

    // ✅ SAVE PATIENT
    const patient = await prisma.patient.create({
      data: {
        firstName,
        lastName,
        age: age ? parseInt(age) : 0,
        gender,
        address,
        contact,
        occupation,

        vitals: {
          create: {
            height: height ? parseFloat(height) : null,
            weight: weight ? parseFloat(weight) : null,
            pulseRate: pulseRate ? parseInt(pulseRate) : null,
            bloodPressure,
            temperature: temperature ? parseFloat(temperature) : null,
          },
        },

        history: {
          create: {
            hasDiabetes: familyDiabetes || false,
            hasHypertension: familyHypertension || false,
            notes: pastIllness || null,
          },
        },

        symptoms: {
          create: Array.isArray(symptoms)
            ? symptoms.map((s) => ({ name: s }))
            : [],
        },
      },
    });

    console.log("✅ Patient saved");

    // =========================
    // ✅ SAVE APPOINTMENT
    // =========================
    const savedAppointment = await prisma.appointment.create({
      data: {
        date: date ? new Date(date) : new Date(),
        doctorEmail,
        patientId: patient.id,
        status: "PENDING",
      },
    });

    const appointmentId = savedAppointment.id;

    console.log("✅ Appointment saved:", appointmentId);

    // ================= PDF =================
    const doc = new PDFDocument({ margin: 50 });
    const filePath = "patient_form.pdf";

    doc.pipe(fs.createWriteStream(filePath));

    doc.fontSize(12).text("Republic of the Philippines", { align: "center" });
    doc.text("Barangay Leon Garcia", { align: "center" });
    doc.text("Health Center", { align: "center" });

    doc.moveDown(0.5);

    doc.fontSize(16).fillColor("#0A4D68")
      .text("Barangay Health Worker (BHW)", { align: "center" });

    doc.moveDown(0.3);

    doc.fontSize(18).fillColor("black")
      .text("Patient Consultation Report", { align: "center" });

    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    doc.fontSize(14).fillColor("#0A4D68").text("PATIENT INFORMATION");
    doc.moveDown(0.5);

    doc.fontSize(11).fillColor("black");

    doc.text(`Name: ${firstName || ""} ${middleName || ""} ${lastName || ""}`);
    doc.text(`Age: ${age || "Not provided"}`);
    doc.text(`Gender: ${gender || "Not provided"}`);
    doc.text(`Height: ${height || "Not provided"} cm`);
    doc.text(`Weight: ${weight || "Not provided"} kg`);
    doc.text(`Pulse Rate: ${pulseRate || "Not provided"} bpm`);
    doc.text(`Blood Pressure: ${bloodPressure || "Not provided"}`);
    doc.text(`Temperature: ${temperature || "Not provided"} °C`);
    doc.text(`Contact: ${contact || "Not provided"}`);
    doc.text(`Address: ${address || "Not provided"}`);
    doc.text(`Occupation: ${occupation || "Not provided"}`);

    doc.moveDown();

    doc.fontSize(14).fillColor("#0A4D68").text("MEDICAL HISTORY");
    doc.moveDown(0.5);

    doc.fontSize(11).fillColor("black");

    doc.text(`Past Illness: ${pastIllness || "None"}`);
    doc.text(`Medications: ${medications || "None"}`);
    doc.text(`Allergies: ${allergies || "None"}`);

    doc.moveDown();

    doc.fontSize(14).fillColor("#0A4D68").text("LIFESTYLE");
    doc.moveDown(0.5);

    doc.fontSize(11).fillColor("black");

    const isSmoker =
      smoker === true ||
      smoker === "true" ||
      smoker === "on" ||
      smoker === "yes" ||
      smoker === 1 ||
      smoker === "1";

    const isAlcohol =
      alcoholUse === true ||
      alcoholUse === "true" ||
      alcoholUse === "on" ||
      alcoholUse === "yes" ||
      alcoholUse === 1 ||
      alcoholUse === "1";

    doc.text(`Smoker: ${isSmoker ? "Yes" : "No"}`);
    doc.text(`Alcohol Use: ${isAlcohol ? "Yes" : "No"}`);
    
    doc.moveDown();

    doc.fontSize(14).fillColor("#0A4D68").text("FAMILY HISTORY");
    doc.moveDown(0.5);

    doc.fontSize(11).fillColor("black");

    doc.text(`Hypertension: ${familyHypertension ? "Yes" : "No"}`);
    doc.text(`Diabetes: ${familyDiabetes ? "Yes" : "No"}`);

    doc.moveDown();

    doc.fontSize(14).fillColor("#0A4D68").text("SYMPTOMS");
    doc.moveDown(0.5);

    doc.fontSize(11).fillColor("black");

    doc.text(
      Array.isArray(symptoms) && symptoms.length > 0
        ? symptoms.join(", ")
        : "None"
    );

    doc.moveDown();

    doc.fontSize(14).fillColor("#0A4D68").text("APPOINTMENT DETAILS");
    doc.moveDown(0.5);

    doc.fontSize(11).fillColor("black");

    doc.text(`Date: ${formatDate(date)}`);
    doc.text(`Messenger Name: ${message || "Not provided"}`);

    doc.end();

    const mailOptions = {
      from: `"Health App" <chlarencedelante@gmail.com>`,
      to: doctorEmail,
      subject: "New Appointment Request",
      html: `
        <h3>Hello ${doctorName || "Doctor"}</h3>
        <p>Please review the appointment.</p>

        <a href="https://backend-production-9df8.up.railway.app/accept/${appointmentId}">
          ✅ ACCEPT
        </a>
        <br/><br/>
        <a href="https://backend-production-9df8.up.railway.app/decline/${appointmentId}">
          ❌ DECLINE
        </a>
      `,
      attachments: [
        {
          filename: "patient_form.pdf",
          path: "./patient_form.pdf",
        },
      ],
    };

    await transporter.sendMail(mailOptions);

    res.json({
      success: true,
      appointmentId,
    });

  } catch (error) {
    console.error("🔥 ERROR:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ================= ACCEPT =================
app.get("/accept/:id", async (req, res) => {
  const id = parseInt(req.params.id);

  await prisma.appointment.update({
    where: { id },
    data: { status: "APPROVED" },
  });

  res.send("✅ Appointment Approved");
});

// ================= DECLINE =================
app.get("/decline/:id", async (req, res) => {
  const id = parseInt(req.params.id);

  await prisma.appointment.update({
    where: { id },
    data: { status: "DECLINED" },
  });

  res.send("❌ Appointment Declined");
});

// ================= STATUS =================
app.get("/status/:id", async (req, res) => {
  const id = parseInt(req.params.id);

  const appointment = await prisma.appointment.findUnique({
    where: { id },
  });

  res.json({ status: appointment.status });
});

// 🔥 ================= URTI WEEKLY DATA =================
app.get("/urti-weekly", async (req, res) => {
  try {
    const today = new Date();
    const days = [];

    for (let i = 6; i >= 0; i--) {
      const start = new Date();
      start.setDate(today.getDate() - i);
      start.setHours(0, 0, 0, 0);

      const end = new Date(start);
      end.setHours(23, 59, 59, 999);

      const patients = await prisma.patient.findMany({
        where: {
          createdAt: {
            gte: start,
            lte: end,
          },
        },
        include: {
          symptoms: true,
        },
      });

      const urtiSymptoms = [
        "Runny nose",
        "Sore throat",
        "Sneezing",
        "Mild cough",
        "Fever",
      ];

      const count = patients.filter(p => p.isURTI).length;

      days.push({
        day: start.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        cases: count,
      });
    }

    res.json(days);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ================= SAVE PATIENT (ONLY ADDED) =================
app.post("/save-patient", async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      age,
      gender,
      address,
      contact,
      occupation,
      height,
      weight,
      pulseRate,
      bloodPressure,
      temperature,
      symptoms,
      familyHypertension,
      familyDiabetes,
      pastIllness,
    } = req.body;

    const urtiSymptoms = [
      "Runny nose",
      "Sore throat",
      "Sneezing",
      "Mild cough",
      "Fever",
    ];

    const hasURTI =
      Array.isArray(symptoms) &&
      symptoms.filter(s => urtiSymptoms.includes(s)).length >= 2;

    await prisma.patient.create({
      data: {
        firstName,
        lastName,
        age: age ? parseInt(age) : 0,
        gender,
        address,
        contact,
        occupation,
        isURTI: hasURTI,
        vitals: {
          create: {
            height: height ? parseFloat(height) : null,
            weight: weight ? parseFloat(weight) : null,
            pulseRate: pulseRate ? parseInt(pulseRate) : null,
            bloodPressure,
            temperature: temperature ? parseFloat(temperature) : null,
          },
        },
        history: {
          create: {
            hasDiabetes: familyDiabetes || false,
            hasHypertension: familyHypertension || false,
            notes: pastIllness || null,
          },
        },
        symptoms: {
          create: Array.isArray(symptoms)
            ? symptoms.map((s) => ({ name: s }))
            : [],
        },
      },
    });

    res.json({ success: true });

  } catch (error) {
    console.error("🔥 SAVE PATIENT ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});