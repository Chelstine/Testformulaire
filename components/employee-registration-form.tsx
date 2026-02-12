"use client"

import React from "react"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2, Loader2, Eye, EyeOff, User, Briefcase, Calendar, Lock, Check, X, Mail, Phone, Upload } from "lucide-react"

interface FormData {
  nom: string
  prenom: string
  poste: string
  dateNaissance: string
  email: string
  telephone: string
  pin: string
  confirmPin: string
}

interface FormErrors {
  nom?: string
  prenom?: string
  poste?: string
  dateNaissance?: string
  email?: string
  telephone?: string
  photo?: string
  pin?: string
  confirmPin?: string
  general?: string
}

export function EmployeeRegistrationForm() {
  const [formData, setFormData] = useState<FormData>({
    nom: "",
    prenom: "",
    poste: "",
    dateNaissance: "",
    email: "",
    telephone: "",
    pin: "",
    confirmPin: "",
  })
  const [photo, setPhoto] = useState<File | null>(null)
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [matricule, setMatricule] = useState("")
  const [showPin, setShowPin] = useState(false)
  const [showConfirmPin, setShowConfirmPin] = useState(false)
  const [isPinChecking, setIsPinChecking] = useState(false)
  const [isPinAvailable, setIsPinAvailable] = useState<boolean | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Debounced PIN availability check
  const checkPinAvailability = useCallback(async (pin: string) => {
    if (!/^\d{4,6}$/.test(pin)) {
      setIsPinAvailable(null)
      return
    }

    setIsPinChecking(true)
    try {
      const response = await fetch(`/api/employees?pin=${pin}`)
      const data = await response.json()
      setIsPinAvailable(data.available)
      if (!data.available) {
        setErrors(prev => ({ ...prev, pin: "Ce code PIN est déjà utilisé" }))
      } else {
        setErrors(prev => ({ ...prev, pin: undefined }))
      }
    } catch {
      // Silently fail - will be caught on submit
    } finally {
      setIsPinChecking(false)
    }
  }, [])

  // Check PIN availability with debounce
  useEffect(() => {
    if (formData.pin.length >= 4) {
      const timer = setTimeout(() => {
        checkPinAvailability(formData.pin)
      }, 500)
      return () => clearTimeout(timer)
    } else {
      setIsPinAvailable(null)
    }
  }, [formData.pin, checkPinAvailability])

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.nom.trim()) newErrors.nom = "Le nom est requis"
    if (!formData.prenom.trim()) newErrors.prenom = "Le prénom est requis"
    if (!formData.poste.trim()) newErrors.poste = "Le poste est requis"
    if (!formData.dateNaissance) newErrors.dateNaissance = "La date de naissance est requise"

    if (!formData.email.trim()) {
      newErrors.email = "L'email est requis"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Format d'email invalide"
    }

    if (!formData.telephone.trim()) {
      newErrors.telephone = "Le téléphone est requis"
    }

    // Photo validation is optional in this version, or make it required:
    // if (!photo) newErrors.photo = "La photo est requise"

    if (!formData.pin) {
      newErrors.pin = "Le code PIN est requis"
    } else if (!/^\d{4,6}$/.test(formData.pin)) {
      newErrors.pin = "Le PIN doit contenir entre 4 et 6 chiffres"
    } else if (isPinAvailable === false) {
      newErrors.pin = "Ce code PIN est déjà utilisé"
    }

    if (!formData.confirmPin) {
      newErrors.confirmPin = "La confirmation du PIN est requise"
    } else if (formData.pin !== formData.confirmPin) {
      newErrors.confirmPin = "Les codes PIN ne correspondent pas"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPhoto(e.target.files[0])
      setErrors(prev => ({ ...prev, photo: undefined }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)
    setErrors({})

    try {
      const submitData = new FormData()
      submitData.append("nom", formData.nom)
      submitData.append("prenom", formData.prenom)
      submitData.append("poste", formData.poste)
      submitData.append("dateNaissance", formData.dateNaissance)
      submitData.append("email", formData.email)
      submitData.append("telephone", formData.telephone)
      submitData.append("pin", formData.pin)
      if (photo) {
        submitData.append("photo", photo)
      }

      const response = await fetch("/api/employees", {
        method: "POST",
        body: submitData, // Browser sets Content-Type to multipart/form-data automatically
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 409) {
          setErrors({ pin: data.error })
        } else {
          setErrors({ general: data.error || "Une erreur est survenue" })
        }
        return
      }

      setMatricule(data.matricule)
      setIsSuccess(true)
    } catch {
      setErrors({
        general: "Une erreur est survenue. Veuillez réessayer.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  const handlePinChange = (field: "pin" | "confirmPin", value: string) => {
    const numericValue = value.replace(/\D/g, "").slice(0, 6)
    handleInputChange(field, numericValue)
    if (field === "pin") {
      setIsPinAvailable(null)
    }
  }

  const resetForm = () => {
    setFormData({
      nom: "",
      prenom: "",
      poste: "",
      dateNaissance: "",
      email: "",
      telephone: "",
      pin: "",
      confirmPin: "",
    })
    setPhoto(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
    setErrors({})
    setIsSuccess(false)
    setMatricule("")
    setIsPinAvailable(null)
  }

  if (isSuccess) {
    return (
      <Card className="w-full max-w-md mx-auto border-0 shadow-2xl">
        <CardContent className="pt-8 pb-8">
          <div className="text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Inscription Réussie !
            </h2>
            <p className="text-muted-foreground mb-6">
              Bienvenue dans l&apos;équipe NOVEK AI. Un email de confirmation a été envoyé à {formData.email}.
            </p>
            <div className="bg-muted rounded-xl p-6 mb-6">
              <p className="text-sm text-muted-foreground mb-2">Votre matricule</p>
              <p className="text-2xl font-mono font-bold text-primary">{matricule}</p>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Conservez votre code PIN en lieu sûr. Il sera nécessaire pour le pointage.
            </p>
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800 mb-2">Faites votre premier pointage ici :</p>
              <a
                href="https://pointage.novekai.agency"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary font-semibold hover:underline flex items-center justify-center gap-2"
              >
                pointage.novekai.agency
                <Briefcase className="w-4 h-4" />
              </a>
            </div>
            <Button onClick={resetForm} className="w-full" size="lg">
              Nouvelle inscription
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md mx-auto border-0 shadow-2xl">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-2xl font-bold text-foreground">
          Enregistrement Employé
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Créez votre profil pour accéder au système de pointage
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {errors.general && (
            <Alert variant="destructive">
              <AlertDescription>{errors.general}</AlertDescription>
            </Alert>
          )}

          {/* Nom */}
          <div className="space-y-2">
            <Label htmlFor="nom" className="text-sm font-medium flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              Nom
            </Label>
            <Input
              id="nom"
              type="text"
              placeholder="Entrez votre nom"
              value={formData.nom}
              onChange={(e) => handleInputChange("nom", e.target.value)}
              className={`h-12 ${errors.nom ? "border-destructive" : ""}`}
              disabled={isSubmitting}
            />
            {errors.nom && (
              <p className="text-sm text-destructive">{errors.nom}</p>
            )}
          </div>

          {/* Prénom */}
          <div className="space-y-2">
            <Label htmlFor="prenom" className="text-sm font-medium flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              Prénom
            </Label>
            <Input
              id="prenom"
              type="text"
              placeholder="Entrez votre prénom"
              value={formData.prenom}
              onChange={(e) => handleInputChange("prenom", e.target.value)}
              className={`h-12 ${errors.prenom ? "border-destructive" : ""}`}
              disabled={isSubmitting}
            />
            {errors.prenom && (
              <p className="text-sm text-destructive">{errors.prenom}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" />
              Email professionnel
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="exemple@novekai.com"
              value={formData.email}
              onChange={(e) => handleInputChange("email", e.target.value)}
              className={`h-12 ${errors.email ? "border-destructive" : ""}`}
              disabled={isSubmitting}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email}</p>
            )}
          </div>

          {/* Téléphone */}
          <div className="space-y-2">
            <Label htmlFor="telephone" className="text-sm font-medium flex items-center gap-2">
              <Phone className="w-4 h-4 text-primary" />
              Téléphone
            </Label>
            <Input
              id="telephone"
              type="tel"
              placeholder="+225 01 02 03 04 05"
              value={formData.telephone}
              onChange={(e) => handleInputChange("telephone", e.target.value)}
              className={`h-12 ${errors.telephone ? "border-destructive" : ""}`}
              disabled={isSubmitting}
            />
            {errors.telephone && (
              <p className="text-sm text-destructive">{errors.telephone}</p>
            )}
          </div>

          {/* Photo Upload */}
          <div className="space-y-2">
            <Label htmlFor="photo" className="text-sm font-medium flex items-center gap-2">
              <Upload className="w-4 h-4 text-primary" />
              Photo de profil
            </Label>
            <Input
              id="photo"
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              ref={fileInputRef}
              className={`cursor-pointer ${errors.photo ? "border-destructive" : ""}`}
              disabled={isSubmitting}
            />
            {errors.photo && (
              <p className="text-sm text-destructive">{errors.photo}</p>
            )}
          </div>

          {/* Poste */}
          <div className="space-y-2">
            <Label htmlFor="poste" className="text-sm font-medium flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-primary" />
              Poste / Fonction
            </Label>
            <Input
              id="poste"
              type="text"
              placeholder="Ex: Développeur, Manager, RH..."
              value={formData.poste}
              onChange={(e) => handleInputChange("poste", e.target.value)}
              className={`h-12 ${errors.poste ? "border-destructive" : ""}`}
              disabled={isSubmitting}
            />
            {errors.poste && (
              <p className="text-sm text-destructive">{errors.poste}</p>
            )}
          </div>

          {/* Date de naissance */}
          <div className="space-y-2">
            <Label htmlFor="dateNaissance" className="text-sm font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              Date de naissance
            </Label>
            <Input
              id="dateNaissance"
              type="date"
              value={formData.dateNaissance}
              onChange={(e) => handleInputChange("dateNaissance", e.target.value)}
              className={`h-12 ${errors.dateNaissance ? "border-destructive" : ""}`}
              disabled={isSubmitting}
            />
            {errors.dateNaissance && (
              <p className="text-sm text-destructive">{errors.dateNaissance}</p>
            )}
          </div>

          {/* Code PIN */}
          <div className="space-y-2">
            <Label htmlFor="pin" className="text-sm font-medium flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary" />
              Code PIN (4-6 chiffres)
            </Label>
            <div className="relative">
              <Input
                id="pin"
                type={showPin ? "text" : "password"}
                placeholder="••••••"
                value={formData.pin}
                onChange={(e) => handlePinChange("pin", e.target.value)}
                className={`h-12 pr-20 font-mono text-lg tracking-widest ${errors.pin ? "border-destructive" : isPinAvailable === true ? "border-green-500" : ""}`}
                disabled={isSubmitting}
                maxLength={6}
                inputMode="numeric"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                {isPinChecking && (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                )}
                {!isPinChecking && isPinAvailable === true && (
                  <Check className="w-4 h-4 text-green-500" />
                )}
                {!isPinChecking && isPinAvailable === false && (
                  <X className="w-4 h-4 text-destructive" />
                )}
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            {errors.pin && (
              <p className="text-sm text-destructive">{errors.pin}</p>
            )}
            {isPinAvailable === true && !errors.pin && (
              <p className="text-sm text-green-600">Ce code PIN est libre (Identifiant unique)</p>
            )}
          </div>

          {/* Confirmation PIN */}
          <div className="space-y-2">
            <Label htmlFor="confirmPin" className="text-sm font-medium flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary" />
              Confirmer le code PIN
            </Label>
            <div className="relative">
              <Input
                id="confirmPin"
                type={showConfirmPin ? "text" : "password"}
                placeholder="••••••"
                value={formData.confirmPin}
                onChange={(e) => handlePinChange("confirmPin", e.target.value)}
                className={`h-12 pr-12 font-mono text-lg tracking-widest ${errors.confirmPin ? "border-destructive" : ""}`}
                disabled={isSubmitting}
                maxLength={6}
                inputMode="numeric"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPin(!showConfirmPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showConfirmPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.confirmPin && (
              <p className="text-sm text-destructive">{errors.confirmPin}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full h-12 text-base font-semibold mt-6"
            disabled={isSubmitting || isPinAvailable === false}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Enregistrement en cours...
              </>
            ) : (
              "S'enregistrer"
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground mt-4">
            En vous inscrivant, vous acceptez les conditions d&apos;utilisation du système de pointage NOVEK AI.
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
