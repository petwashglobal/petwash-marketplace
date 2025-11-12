import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, Mail, Phone, Calendar, Gift, Wallet, Star } from "lucide-react";

export default function FounderMember() {
  const { data: founderData, isLoading } = useQuery({
    queryKey: ['/api/founder-member'],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!founderData?.success) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Founder Member Not Found</h1>
          <p className="text-gray-600">Please contact support for assistance.</p>
        </div>
      </div>
    );
  }

  const founder = founderData.founder;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Crown className="w-8 h-8 text-yellow-500" />
            <h1 className="text-3xl font-bold text-gray-800">Pet Wash™ Founder Member</h1>
          </div>
          <p className="text-gray-600">Welcome to the exclusive founder's club</p>
        </div>

        {/* Main Card */}
        <Card className="bg-white shadow-xl">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-lg">
            <CardTitle className="text-2xl flex items-center gap-2">
              <Crown className="w-6 h-6" />
              Founder Member Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            <div className="grid md:grid-cols-2 gap-8">
              {/* Left Column - Personal Info */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Personal Information</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-semibold">
                          {founder.name.split(' ').map((n: string) => n[0]).join('')}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{founder.name}</p>
                        <p className="text-sm text-gray-600">Founder & First Member</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Mail className="w-5 h-5 text-gray-400" />
                      <span className="text-gray-700">{founder.email}</span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5 text-gray-400" />
                      <span className="text-gray-700">{founder.phone}</span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-gray-400" />
                      <span className="text-gray-700">
                        Member since {new Date(founder.memberSince).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Loyalty Status */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Loyalty Status</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Star className="w-5 h-5 text-yellow-500" />
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 capitalize">
                        {founder.loyaltyTier} Tier
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Gift className="w-5 h-5 text-green-500" />
                      <span className="text-gray-700">
                        {founder.discountPercent}% Discount on All Services
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs">✓</span>
                      </div>
                      <span className="text-gray-700">
                        {founder.isClubMember ? 'Active Club Member' : 'Not a club member'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Stats */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Account Summary</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-blue-600">₪{founder.totalSpent}</div>
                      <div className="text-sm text-gray-600">Total Spent</div>
                    </div>
                    
                    <div className="bg-green-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-green-600">{founder.washBalance}</div>
                      <div className="text-sm text-gray-600">Wash Credits</div>
                    </div>
                  </div>
                </div>

                {/* Special Privileges */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Founder Privileges</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span>Lifetime {founder.discountPercent}% discount</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span>Priority customer support</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span>Early access to new features</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span>Exclusive franchise opportunities</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-600">
          <p>Thank you for being the foundation of Pet Wash™</p>
          <p className="text-sm mt-2">Your vision made this premium pet care platform possible</p>
        </div>
      </div>
    </div>
  );
}