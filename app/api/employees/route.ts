import { NextRequest, NextResponse } from "next/server"
import nodemailer from "nodemailer"

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID
const TABLE_NAME = "Employees"

// Email Configuration (Placeholder - to be updated with real credentials)
const EMAIL_HOST = process.env.EMAIL_HOST || "smtp.example.com"
const EMAIL_PORT = parseInt(process.env.EMAIL_PORT || "587")
const EMAIL_USER = process.env.EMAIL_USER || "user@example.com"
const EMAIL_PASS = process.env.EMAIL_PASS || "password"

interface AirtableRecord {
  id: string
  fields: {
    nom?: string
    prenom?: string
    poste?: string
    date_naissance?: string
    pin?: string
    matricule?: string
    email?: string
    telephone?: string
    photo?: any // Attachment array for Airtable
    actif?: boolean
    date_inscription?: string
  }
}

interface AirtableResponse {
  records: AirtableRecord[]
  offset?: string
}

// Check if PIN already exists
async function checkPinExists(pin: string): Promise<boolean> {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}?filterByFormula={pin}="${pin}"`

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
  })

  if (!response.ok) {
    throw new Error("Erreur lors de la vérification du PIN")
  }

  const data: AirtableResponse = await response.json()
  return data.records.length > 0
}

// Generate unique matricule with Initials
function generateMatricule(nom: string, prenom: string): string {
  const year = new Date().getFullYear()
  const randomNum = Math.floor(Math.random() * 99999).toString().padStart(5, "0")

  // Get initials (First letter of Nom + First letter of Prenom)
  const initialNom = nom.charAt(0).toUpperCase()
  const initialPrenom = prenom.charAt(0).toUpperCase()

  return `NOV-${initialNom}${initialPrenom}-${year}-${randomNum}`
}

// Send Welcome Email
async function sendWelcomeEmail(to: string, nom: string, prenom: string, matricule: string) {
  try {
    // Create transporter
    const transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: EMAIL_PORT,
      secure: EMAIL_PORT === 465, // true for 465, false for other ports
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
    })

    // Email content
    const mailOptions = {
      from: `"NOVEK AI" <${EMAIL_USER}>`,
      to: to,
      subject: "Bienvenue chez NOVEK AI - Votre Inscription",
      html: `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h1 style="color: #2D4B8E;">Bienvenue chez NOVEK AI !</h1>
          <p>Bonjour <strong>${prenom} ${nom}</strong>,</p>
          <p>Votre inscription au système de pointage a été validée avec succès.</p>
          <div style="background-color: #f0f4fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #666;">Votre Matricule :</p>
            <p style="margin: 5px 0 0; font-size: 24px; font-weight: bold; color: #2D4B8E;">${matricule}</p>
          </div>
          <p>Vous pouvez désormais utiliser ce matricule et votre code PIN pour pointer.</p>
          <p>Cordialement,<br>L'équipe NOVEK AI</p>
        </div>
      `,
    }

    // Send email (Only if configured, otherwise log it)
    if (EMAIL_HOST !== "smtp.example.com") {
      await transporter.sendMail(mailOptions)
      console.log(`[v0] Email sent to ${to}`)
    } else {
      console.log(`[v0] Email simulation: To ${to}, Matricule: ${matricule}`)
    }
  } catch (error) {
    console.error("[v0] Error sending email:", error)
    // Don't throw error to prevent blocking the registration response
  }
}

// Cloudinary Configuration
import { v2 as cloudinary } from "cloudinary"

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// POST - Create new employee
export async function POST(request: NextRequest) {
  try {
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      return NextResponse.json(
        { error: "Configuration Airtable manquante" },
        { status: 500 }
      )
    }

    // Parse FormData
    const formData = await request.formData()
    const nom = formData.get("nom") as string
    const prenom = formData.get("prenom") as string
    const poste = formData.get("poste") as string
    const dateNaissance = formData.get("dateNaissance") as string
    const pin = formData.get("pin") as string
    const email = formData.get("email") as string
    const telephone = formData.get("telephone") as string
    const photo = formData.get("photo") as File | null

    // Validate required fields
    if (!nom || !prenom || !poste || !dateNaissance || !pin || !email || !telephone) {
      return NextResponse.json(
        { error: "Tous les champs obligatoires sont requis" },
        { status: 400 }
      )
    }

    // Validate PIN format
    if (!/^\d{4,6}$/.test(pin)) {
      return NextResponse.json(
        { error: "Le PIN doit contenir entre 4 et 6 chiffres" },
        { status: 400 }
      )
    }

    // Check if PIN already exists
    const pinExists = await checkPinExists(pin)
    if (pinExists) {
      return NextResponse.json(
        { error: "Ce code PIN est déjà utilisé. Veuillez en choisir un autre." },
        { status: 409 }
      )
    }

    // Generate matricule (Using first 3 letters of Nom + First letter of Prenom)
    // Example: KOUAME Jean -> KOUJ-2024-12345
    const matricule = generateMatricule(nom, prenom)

    // Handle Photo Upload to Cloudinary
    let photoUrl = ""
    if (photo) {
      try {
        // Convert file to buffer
        const arrayBuffer = await photo.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // Upload to Cloudinary
        const result = await new Promise<any>((resolve, reject) => {
          cloudinary.uploader.upload_stream(
            {
              folder: "novek-employees",
              public_id: `photo_${matricule}`,
              overwrite: true,
              resource_type: "image"
            },
            (error, result) => {
              if (error) reject(error)
              else resolve(result)
            }
          ).end(buffer)
        })

        photoUrl = result.secure_url
      } catch (uploadError) {
        console.error("Cloudinary upload failed:", uploadError)
        // Optionally fail or continue without photo
        // For now we continue, but you might want to return an error
      }
    }

    // Create employee in Airtable
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}`

    // Construct fields
    const fields: any = {
      nom,
      prenom,
      poste,
      date_naissance: dateNaissance,
      pin,
      matricule,
      email,
      telephone,
      actif: true,
      date_inscription: new Date().toISOString().split("T")[0],
    }

    // Add photo if uploaded successfully
    if (photoUrl) {
      fields.photo = [{ url: photoUrl }]
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        records: [
          {
            fields: fields,
          },
        ],
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error("[v0] Airtable error:", errorData)
      return NextResponse.json(
        { error: "Erreur lors de la création de l'employé dans Airtable" },
        { status: 500 }
      )
    }

    const data = await response.json()
    const createdEmployee = data.records[0]

    // Send Welcome Email in background to speed up response
    // We don't 'await' it so the user gets the success screen immediately
    sendWelcomeEmail(email, nom, prenom, matricule).catch(err => {
      console.error("[v0] Background email sending failed:", err)
    })

    return NextResponse.json({
      success: true,
      matricule,
      employeeId: createdEmployee.id,
    })
  } catch (error: any) {
    console.error("[v0] CRITICAL ERROR in /api/employees:", error)
    return NextResponse.json(
      {
        error: "Une erreur est survenue lors de l'enregistrement",
        details: error?.message || "Unknown error"
      },
      { status: 500 }
    )
  }
}

// GET - Check PIN uniqueness
export async function GET(request: NextRequest) {
  try {
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      return NextResponse.json(
        { error: "Configuration Airtable manquante" },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(request.url)
    const pin = searchParams.get("pin")

    if (!pin) {
      return NextResponse.json(
        { error: "Le PIN est requis" },
        { status: 400 }
      )
    }

    const pinExists = await checkPinExists(pin)

    return NextResponse.json({
      available: !pinExists,
    })
  } catch (error) {
    console.error("[v0] Error checking PIN:", error)
    return NextResponse.json(
      { error: "Erreur lors de la vérification du PIN" },
      { status: 500 }
    )
  }
}
