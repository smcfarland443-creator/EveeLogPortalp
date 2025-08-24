import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-full flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-primary-500 rounded-xl flex items-center justify-center mb-6">
            <i className="fas fa-car text-white text-2xl"></i>
          </div>
          <h2 className="text-3xl font-bold text-gray-900">AutoTransfer Pro</h2>
          <p className="mt-2 text-sm text-gray-600">
            Professionelle Fahrzeugüberführungsplattform
          </p>
        </div>
        
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Willkommen bei AutoTransfer Pro
                </h3>
                <p className="text-sm text-gray-600 mb-6">
                  Melden Sie sich an, um auf Ihre Überführungsaufträge zuzugreifen.
                </p>
              </div>
              
              <Button 
                onClick={handleLogin}
                className="w-full bg-primary-500 hover:bg-primary-600 text-white"
                data-testid="button-login"
              >
                Jetzt anmelden
              </Button>
              
              <div className="text-center">
                <p className="text-xs text-gray-500">
                  Noch kein Konto? Kontaktieren Sie Ihren Administrator für die Registrierung.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
