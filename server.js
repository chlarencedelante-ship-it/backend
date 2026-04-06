import dotenv from "dotenv";
dotenv.config();
import express from "express";
import nodemailer from "nodemailer";
import cors from "cors";

// ✅ Prisma
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// ✅ ADDED: Prisma connection handler
async function connectDB() {
  try {
    await prisma.$connect();
    console.log("✅ Database connected");
  } catch (err) {
    console.error("❌ Database connection failed:", err);
    process.exit(1);
  }
}

// PDF
import fs from "fs";
import PDFDocument from "pdfkit";
import { PassThrough } from "stream"; // ✅ ADDED

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

    const doc = new PDFDocument({ margin: 50 });

    // ✅ FIXED: Use memory instead of file
    const stream = new PassThrough();
    const chunks = [];

    stream.on("data", (chunk) => chunks.push(chunk));

    stream.on("end", async () => {
      const pdfBuffer = Buffer.concat(chunks);

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
            content: pdfBuffer, // ✅ FIXED
          },
        ],
      };

      await transporter.sendMail(mailOptions);

      res.json({
        success: true,
        appointmentId,
      });
    });

    doc.pipe(stream);

    // (PDF content unchanged)
    doc.fontSize(12).text("Republic of the Philippines", { align: "center" });
    doc.text("Barangay Leon Garcia", { align: "center" });
    doc.text("Health Center", { align: "center" });

    doc.moveDown(0.5);

    doc.fontSize(16).fillColor("#0A4D68")
      .text("Barangay Health Worker (BHW)", { align: "center" });

    doc.moveDown(0.3);

    doc.fontSize(18).fillColor("black")
      .text("Patient Consultation Report", { align: "center" });

    doc.end();

  } catch (error) {
    console.error("🔥 ERROR:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// (REST OF YOUR CODE UNCHANGED)

// ✅ START SERVER
const PORT = process.env.PORT || 5000;

async function startServer() {
  await connectDB();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

startServer();