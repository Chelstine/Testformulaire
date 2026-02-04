import { NextRequest, NextResponse } from "next/server"

const AIRTABLE_API_KEY = 'patzYhseux31kAAT0.8712c0d026f16e1ececcd37ab101a59925147429535bd8d3dd3b002ab6b8330f'
const AIRTABLE_BASE_ID = 'appG6xMsDsHJRZAkn'
const TABLE_NAME = "Employees"

interface AirtableRecord {
  id: string
  fields: {
    nom?: string
    prenom?: string
    poste?: string
    date_naissance?: string
    pin?: string
    matricule?: string
    qr_id?: string
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

// Generate unique matricule
function generateMatricule(): string {
  const year = new Date().getFullYear()
  const randomNum = Math.floor(Math.random() * 99999).toString().padStart(5, "0")
  return `NOV-EMP-${year}-${randomNum}`
}

// Generate unique QR ID
function generateQrId(): string {
  const randomNum = Math.floor(Math.random() * 99999).toString().padStart(5, "0")
  return `EMP-${randomNum}`
}

// POST - Create new employee
export async function POST(request: NextRequest) {
  try {
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      return NextResponse.json(
        { error: "Configuration Airtable manquante" },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { nom, prenom, poste, dateNaissance, pin } = body

    // Validate required fields
    if (!nom || !prenom || !poste || !dateNaissance || !pin) {
      return NextResponse.json(
        { error: "Tous les champs sont requis" },
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

    // Generate matricule and QR ID
    const matricule = generateMatricule()
    const qrId = generateQrId()

    // Create employee in Airtable
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}`
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        records: [
          {
            fields: {
              nom,
              prenom,
              poste,
              date_naissance: dateNaissance,
              pin,
              matricule,
              qr_id: qrId,
              actif: true,
              date_inscription: new Date().toISOString().split("T")[0],
            },
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

    return NextResponse.json({
      success: true,
      matricule,
      qrId,
      employeeId: createdEmployee.id,
    })
  } catch (error) {
    console.error("[v0] Error creating employee:", error)
    return NextResponse.json(
      { error: "Une erreur est survenue lors de l'enregistrement" },
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
