import Image from "next/image"
import { EmployeeRegistrationForm } from "@/components/employee-registration-form"

export default function RegisterPage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card shadow-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-center">
          <Image
            src="/images/logo-novek.jpeg"
            alt="NOVEK AI Logo"
            width={150}
            height={60}
            className="h-12 w-auto"
            priority
          />
        </div>
      </header>

      {/* Main Content */}
      <div className="px-4 py-8 md:py-12">
        <div className="max-w-md mx-auto">
          {/* Welcome Section */}
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3 text-balance">
              Bienvenue chez{" "}
              <span className="text-primary">NOVEK</span>{" "}
              <span className="text-secondary">AI</span>
            </h1>
            <p className="text-muted-foreground text-lg">
              Système d'enregistrement des employés
            </p>
          </div>

          {/* Registration Form */}
          <EmployeeRegistrationForm />

          {/* Footer Info */}
          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              Besoin d'aide ?{" "}
              <a href="#" className="text-primary hover:underline font-medium">
                Contactez le support
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} NOVEK AI. Tous droits réservés.
          </p>
        </div>
      </footer>
    </main>
  )
}
