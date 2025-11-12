import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Menu, MoreVertical, Grid3X3, Settings } from 'lucide-react';
import { t, type Language } from '@/lib/i18n';

export default function MenuDesigns() {
  const [language, setLanguage] = useState<Language>('en');

  const menuDesigns = [
    {
      id: 1,
      name: 'Classic Hamburger',
      icon: <Menu className="w-6 h-6" />,
      description: 'Traditional three-line hamburger menu'
    },
    {
      id: 2,
      name: 'Vertical Dots',
      icon: <MoreVertical className="w-6 h-6" />,
      description: 'Three vertical dots menu'
    },
    {
      id: 3,
      name: 'Grid Menu',
      icon: <Grid3X3 className="w-6 h-6" />,
      description: 'Nine-dot grid pattern'
    },
    {
      id: 4,
      name: 'Custom Lines',
      icon: (
        <div className="flex flex-col space-y-1">
          <div className="w-4 h-0.5 bg-black"></div>
          <div className="w-4 h-0.5 bg-black"></div>
          <div className="w-4 h-0.5 bg-black"></div>
        </div>
      ),
      description: 'Custom styled hamburger lines'
    },
    {
      id: 5,
      name: 'Staggered Lines',
      icon: (
        <div className="flex flex-col items-end space-y-1">
          <div className="w-4 h-0.5 bg-black"></div>
          <div className="w-3 h-0.5 bg-black"></div>
          <div className="w-4 h-0.5 bg-black"></div>
        </div>
      ),
      description: 'Staggered line lengths for modern look'
    },
    {
      id: 6,
      name: 'Minimalist Dots',
      icon: (
        <div className="flex flex-col space-y-1 items-center">
          <div className="w-1 h-1 bg-black rounded-full"></div>
          <div className="w-1 h-1 bg-black rounded-full"></div>
          <div className="w-1 h-1 bg-black rounded-full"></div>
        </div>
      ),
      description: 'Ultra-minimal three dots'
    }
  ];

  return (
    <Layout>
      <div className="min-h-screen bg-white py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-2xl font-bold text-black mb-4">
              Hamburger Menu Design Options
            </h1>
            <p className="text-lg text-gray-700">
              Choose the perfect menu style for Pet Wash™️
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {menuDesigns.map((design) => (
              <Card key={design.id} className="border shadow-lg hover:shadow-xl transition-shadow">
                <CardContent className="p-8 text-center">
                  <div className="mb-6">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="w-16 h-16 border-2 border-gray-200 hover:border-black transition-colors"
                    >
                      {design.icon}
                    </Button>
                  </div>
                  <h3 className="text-xl font-bold text-black mb-2">
                    {design.name}
                  </h3>
                  <p className="text-gray-600 text-sm">
                    {design.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-16 text-center">
            <h2 className="text-2xl font-bold text-black mb-8">
              Current Layout Preview
            </h2>
            <div className="bg-white p-8 rounded-lg max-w-4xl mx-auto">
              <div className="bg-white border-b border-gray-200 p-4 rounded-t-lg">
                <div className="grid grid-cols-3 items-center gap-4">
                  {/* Left - Social Icons */}
                  <div className="flex items-center justify-start space-x-3">
                    <div className="w-8 h-8 bg-white border border-pink-500 rounded flex items-center justify-center text-pink-500 text-xs">IG</div>
                    <div className="w-8 h-8 bg-black rounded flex items-center justify-center text-white text-xs">TT</div>
                    <div className="w-8 h-8 bg-white border border-blue-600 rounded flex items-center justify-center text-blue-600 text-xs">FB</div>
                  </div>
                  
                  {/* Center - Logo */}
                  <div className="text-center">
                    <h1 className="text-3xl font-bold text-black">Pet Wash™️</h1>
                  </div>
                  
                  {/* Right - Menu & Language */}
                  <div className="flex flex-col items-end space-y-1">
                    <Button variant="ghost" size="icon" className="w-8 h-8">
                      <Menu className="w-6 h-6" />
                    </Button>
                    <div className="text-xs font-bold">English/עברית</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}