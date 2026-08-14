"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
export default function ContactPage() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Contactez-nous
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Remplissez le formulaire et notre équipe vous répondra sous 24h.
          </p>
        </div>

        <Card className="mt-12 p-6 sm:p-8">
          <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="firstName" className="text-sm font-medium text-foreground">Prénom</label>
                <Input id="firstName" placeholder="Jean" />
              </div>
              <div className="space-y-2">
                <label htmlFor="lastName" className="text-sm font-medium text-foreground">Nom</label>
                <Input id="lastName" placeholder="Dupont" />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-foreground">Email professionnel</label>
              <Input id="email" type="email" placeholder="vous@entreprise.com" />
            </div>

            <div className="space-y-2">
              <label htmlFor="company" className="text-sm font-medium text-foreground">Entreprise</label>
              <Input id="company" placeholder="Acme Corp" />
            </div>

            <div className="space-y-2">
              <label htmlFor="message" className="text-sm font-medium text-foreground">Message</label>
              <textarea
                id="message"
                rows={5}
                placeholder="Décrivez votre besoin..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            <Button type="submit" className="w-full">Envoyer</Button>

            <p className="text-xs text-center text-muted-foreground">
              En soumettant ce formulaire, vous acceptez notre politique de confidentialité.
            </p>
          </form>
        </Card>

        <div className="mt-12 grid gap-6 sm:grid-cols-3 text-center">
          <div>
            <p className="text-sm font-medium text-foreground">Email</p>
            <p className="mt-1 text-sm text-muted-foreground">sales@nexaflow.com</p>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Téléphone</p>
            <p className="mt-1 text-sm text-muted-foreground">+33 1 23 45 67 89</p>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Adresse</p>
            <p className="mt-1 text-sm text-muted-foreground">Paris, France</p>
          </div>
        </div>
      </div>
    </section>
  );
}
