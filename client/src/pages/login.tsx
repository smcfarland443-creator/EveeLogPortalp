import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import eveelogLogo from "@assets/eveelogBLACK_1756238052052.png";

const loginSchema = z.object({
  email: z.string().email("Gültige E-Mail-Adresse erforderlich"),
  password: z.string().min(1, "Passwort ist erforderlich"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function Login() {
  const { toast } = useToast();
  
  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const localLoginMutation = useMutation({
    mutationFn: async (data: LoginFormData) => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Login fehlgeschlagen");
      }
      
      return response.json();
    },
    onSuccess: () => {
      window.location.href = "/";
    },
    onError: (error: Error) => {
      toast({ 
        title: "Login fehlgeschlagen", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  const onSubmit = (data: LoginFormData) => {
    localLoginMutation.mutate(data);
  };

  const handleReplitLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mb-4">
            <img 
              src={eveelogLogo} 
              alt="Eveelog Logo" 
              className="h-16 w-auto mx-auto mb-4"
            />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            Eveelog Portal
          </CardTitle>
          <p className="text-gray-600">Anmelden um fortzufahren</p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Replit OAuth Login */}
          <div className="space-y-4">
            <Button 
              onClick={handleReplitLogin}
              className="w-full bg-primary-500 hover:bg-primary-600 text-white"
              data-testid="button-replit-login"
            >
              <i className="fas fa-code mr-2"></i>
              Mit Replit anmelden
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500">Oder</span>
            </div>
          </div>

          {/* Local Login Form */}
          <div className="space-y-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-Mail</FormLabel>
                      <FormControl>
                        <Input 
                          type="email"
                          placeholder="max@beispiel.de" 
                          {...field} 
                          data-testid="input-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Passwort</FormLabel>
                      <FormControl>
                        <Input 
                          type="password"
                          placeholder="Ihr Passwort" 
                          {...field} 
                          data-testid="input-password"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full bg-gray-800 hover:bg-gray-900 text-white"
                  disabled={localLoginMutation.isPending}
                  data-testid="button-local-login"
                >
                  {localLoginMutation.isPending ? "Anmeldung..." : "Anmelden"}
                </Button>
              </form>
            </Form>
          </div>

          <div className="text-center text-sm text-gray-600">
            <p>Kein Account? Wenden Sie sich an Ihren Administrator.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}