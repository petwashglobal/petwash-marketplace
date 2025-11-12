import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AuthTest() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const testEmailPassword = async () => {
    setLoading(true);
    setResult("");
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      setResult(`✅ SUCCESS! Logged in as: ${userCredential.user.email}`);
    } catch (error: any) {
      setResult(`❌ ERROR: ${error.code}\n${error.message}\n\nDomain: ${window.location.origin}\nAuth Domain: ${(auth.config as any).authDomain}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white p-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>🔍 Firebase Auth Debug Tool</CardTitle>
          <CardDescription>Test email/password authentication directly</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="your password"
            />
          </div>
          <Button
            onClick={testEmailPassword}
            disabled={loading || !email || !password}
            className="w-full"
          >
            {loading ? "Testing..." : "Test Email/Password Sign-In"}
          </Button>
          
          {result && (
            <div className={`p-4 rounded-lg ${result.includes('SUCCESS') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              <pre className="whitespace-pre-wrap text-sm font-mono">{result}</pre>
            </div>
          )}

          <div className="mt-6 p-4 bg-blue-50 rounded-lg text-sm">
            <p className="font-semibold mb-2">📍 Current Configuration:</p>
            <p>• Your Domain: {window.location.origin}</p>
            <p>• Firebase Project: signinpetwash</p>
            <p>• Auth Domain: signinpetwash.firebaseapp.com</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
