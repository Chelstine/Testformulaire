import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID
const TABLE_NAME = "Employees"

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
    const errorText = await response.text()
    console.error(`[v0] Airtable checkPinExists failed: ${response.status} ${response.statusText}`, errorText)
    throw new Error(`Erreur lors de la vérification du PIN (${response.status})`)
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

function getWelcomeEmailHtml(_nom: string, prenom: string, matricule: string, pin: string): string {
  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>NovekAI – Confirmation d'enregistrement</title>
      <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          padding: 0;
          background-color: #f4f6f9;
          font-family: 'Roboto', 'Segoe UI', Arial, sans-serif;
          color: #000000;
          -webkit-text-size-adjust: 100%;
          -ms-text-size-adjust: 100%;
        }

        .email-wrapper {
          background-color: #f4f6f9;
          padding: 32px 16px;
        }

        .email-container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 12px;
          overflow: hidden;
        }

        .email-header {
          background: linear-gradient(135deg, #0a1c3b, #1e3a68);
          color: #ffffff;
          padding: 24px 28px;
        }

        .email-header .brand {
          margin: 0;
          font-size: 12px;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          opacity: 0.85;
        }

        .email-header h1 {
          margin: 10px 0 0;
          font-size: 22px;
          font-weight: 700;
          line-height: 1.3;
        }

        .email-body {
          padding: 28px;
        }

        .email-body p {
          margin: 0 0 16px;
          font-size: 15px;
          line-height: 1.6;
          color: #000000;
        }

        .credentials-box {
          padding: 16px 20px;
          border: 1px solid #e5e7eb;
          text-align: center;
          background-color: #f9fafb;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .credentials-box .label {
          margin: 0;
          text-transform: uppercase;
          font-size: 11px;
          letter-spacing: 0.18em;
          color: #000000;
        }

        .credentials-box .value {
          margin: 6px 0 0;
          font-size: 18px;
          font-weight: 700;
          color: #FFD700;
          letter-spacing: 1px;
        }

        .credentials-box .value-pin {
          margin: 6px 0 0;
          font-size: 18px;
          font-weight: 700;
          color: #FFD700;
          letter-spacing: 4px;
        }

        .credentials-divider {
          border: none;
          border-top: 1px solid #e5e7eb;
          margin: 12px 0;
        }

        .signature {
          margin-top: 8px;
        }

        .email-footer {
          background-color: #f4f6f9;
          padding: 16px 28px;
          text-align: center;
          font-size: 12px;
          color: #4b5563;
        }

        .email-footer p {
          margin: 0;
        }

        @media only screen and (max-width: 480px) {
          .email-wrapper {
            padding: 12px 6px;
          }

          .email-container {
            border-radius: 8px;
          }

          .email-header {
            padding: 18px 20px;
          }

          .email-header .brand {
            font-size: 11px;
          }

          .email-header h1 {
            font-size: 18px;
            margin-top: 8px;
          }

          .email-body {
            padding: 20px 16px;
          }

          .email-body p {
            font-size: 14px;
          }

          .credentials-box {
            padding: 14px 12px;
          }

          .credentials-box .value {
            font-size: 15px;
            letter-spacing: 0.5px;
            word-break: break-all;
          }

          .credentials-box .value-pin {
            font-size: 20px;
            letter-spacing: 6px;
          }

          .email-footer {
            padding: 14px 16px;
            font-size: 11px;
          }
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="email-container">

          <div class="email-header">
            <p class="brand">NovekAI</p>
            <h1>Confirmation d'enregistrement</h1>
          </div>

          <div class="email-body">
            <p>Bonjour <strong>${prenom}</strong>,</p>
            <p>Nous vous confirmons votre enregistrement officiel au sein de <strong>NovekAI</strong>.</p>
            <p>Les identifiants suivants vous ont été attribués :</p>

            <div class="credentials-box">
              <p class="label">Numéro matricule</p>
              <p class="value">${matricule}</p>
              <hr class="credentials-divider">
              <p class="label">Code PIN</p>
              <p class="value-pin">${pin}</p>
            </div>

            <p>Merci de bien vouloir conserver ces informations pour toute démarche administrative interne.</p>
            <p style="margin-bottom: 24px;">Nous vous souhaitons une excellente prise de fonction.</p>

            <div class="signature">
              <p><strong>Cordialement,</strong></p>
              <p style="margin:0;">Direction des Ressources Humaines<br/>NovekAI</p>
            </div>
          </div>

          <div class="email-footer">
            <p>© ${new Date().getFullYear()} NovekAI. Tous droits réservés.</p>
          </div>

        </div>
      </div>
    </body>
    </html>
  `
}

// envoyer via api resend pour plsu de flexibilité
async function sendViaResend(to: string, nom: string, prenom: string, matricule: string, pin: string): Promise<boolean> {
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
      html: getWelcomeEmailHtml(nom, prenom, matricule, pin),
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
async function sendWelcomeEmail(to: string, nom: string, prenom: string, matricule: string, pin: string) {
  console.log(`[v0] Attempting to send email to ${to}...`)
  await sendViaResend(to, nom, prenom, matricule, pin)
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
    sendWelcomeEmail(email, nom, prenom, matricule, pin).catch(err => {
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
