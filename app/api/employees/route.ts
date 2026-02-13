import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID
const TABLE_NAME = "hr_management_system"

// configuration resend beaucoup moins chiant que le smtp de o2switch sur railway
const RESEND_API_KEY = process.env.RESEND_API_KEY

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

// verifier l'existence d'un pin
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

// gabarit HTML pour l'email de confirmation
function getWelcomeEmailHtml(_nom: string, prenom: string, matricule: string): string {
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; background-color:#f5f7fb; padding:32px; color:#1a2340;">
      <div style="max-width:600px; margin:0 auto; background-color:#ffffff; border-radius:16px; box-shadow:0 18px 40px rgba(18,42,92,0.12); overflow:hidden;">
        <div style="background:linear-gradient(135deg,#0b1d3c,#1f3b70); color:#f5f9ff; padding:28px 32px;">
          <p style="margin:0; font-size:12px; letter-spacing:0.3em; text-transform:uppercase; opacity:0.75;">NovekAI</p>
          <h1 style="margin:10px 0 0; font-size:24px; font-weight:700;">Confirmation d'enregistrement</h1>
        </div>
        <div style="padding:32px;">
          <p style="margin:0 0 16px; font-size:16px;">Bonjour ${prenom},</p>
          <p style="margin:0 0 16px; font-size:16px;">Nous vous confirmons votre enregistrement officiel au sein de <strong>NovekAI</strong>.</p>
          <p style="margin:0 0 24px; font-size:16px;">Les identifiants suivants vous ont été attribués :</p>
          <div style="background:linear-gradient(135deg,#eef3ff,#dae4ff); border-radius:14px; padding:24px 28px; border:1px solid rgba(31,59,112,0.18); text-align:center;">
            <p style="margin:0; text-transform:uppercase; font-size:12px; letter-spacing:0.22em; color:#1f3b70; opacity:0.8;">Numéro matricule</p>
            <p style="margin:10px 0 0; font-size:30px; font-weight:700; color:#0b1d3c;">${matricule}</p>
          </div>
          <p style="margin:24px 0 16px; font-size:16px;">Merci de bien vouloir conserver ces informations pour toute démarche administrative interne.</p>
          <p style="margin:0 0 32px; font-size:16px;">Nous vous souhaitons une excellente prise de fonction.</p>
          <p style="margin:0; font-size:16px; font-weight:600;">Cordialement,</p>
          <p style="margin:6px 0 0; font-size:16px;">Direction des Ressources Humaines<br/>NovekAI</p>
        </div>
        <div style="background-color:#f5f7fb; padding:18px 32px; text-align:center; font-size:12px; color:#4c5b7a;">
          <p style="margin:0;">© ${new Date().getFullYear()} NovekAI. Tous droits réservés.</p>
        </div>
      </div>
    </div>
  `
}

// envoyer via api resend pour plsu de flexibilité
async function sendViaResend(to: string, nom: string, prenom: string, matricule: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.log("[v0] ⚠️ RESEND_API_KEY not set, skipping email")
    return false
  }

  try {
    const resend = new Resend(RESEND_API_KEY)
    console.log("[v0] 📡 Sending email via Resend API...")

    const { data, error } = await resend.emails.send({
      from: "NOVEK AI <assistant@inscription.novekai.agency>",
      to: [to],
      subject: "Confirmation d'enregistrement – NovekAI",
      html: getWelcomeEmailHtml(nom, prenom, matricule),
    })

    if (error) {
      console.error("[v0] ❌ Resend error:", error)
      return false
    }

    console.log(`[v0] ✅ Email sent via Resend! ID: ${data?.id}`)
    return true
  } catch (error: any) {
    console.error("[v0] ❌ Resend exception:", error?.message)
    return false
  }
}

// Send Welcome Email
async function sendWelcomeEmail(to: string, nom: string, prenom: string, matricule: string) {
  console.log(`[v0] Attempting to send email to ${to}...`)
  await sendViaResend(to, nom, prenom, matricule)
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

    // Send Welcome Email in background to restore speed
    // We already have detailed logs in the sendWelcomeEmail function
    sendWelcomeEmail(email, nom, prenom, matricule).catch(err => {
      console.error("[v0] Background promise error (should be caught in fn):", err)
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
