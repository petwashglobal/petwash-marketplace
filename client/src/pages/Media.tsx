import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, Video, FileText, Download } from "lucide-react";

export default function Media() {
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="container max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-16">
          <Camera className="w-16 h-16 text-purple-600 mx-auto mb-4" />
          <h1 className="text-5xl font-bold mb-4">Media, Photos and Videos</h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            Brand assets, press materials, and media resources
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setLocation("/gallery")}>
            <Camera className="w-12 h-12 text-purple-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Photo Gallery</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              High-resolution photos of our stations, services, and happy pets
            </p>
            <Button variant="outline" className="w-full" data-testid="button-view-gallery">
              View Gallery
            </Button>
          </Card>

          <Card className="p-6">
            <Video className="w-12 h-12 text-blue-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Video Resources</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Promotional videos, tutorials, and brand stories
            </p>
            <Button variant="outline" className="w-full" data-testid="button-videos">
              Coming Soon
            </Button>
          </Card>

          <Card className="p-6">
            <FileText className="w-12 h-12 text-green-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Press Kit</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Logos, brand guidelines, and press releases
            </p>
            <Button variant="outline" className="w-full" data-testid="button-press-kit">
              <Download className="w-4 h-4 mr-2" />
              Download Kit
            </Button>
          </Card>
        </div>

        <Card className="p-8 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 text-center">
          <h2 className="text-2xl font-bold mb-4">Media Inquiries</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            For press inquiries, interviews, or media partnerships
          </p>
          <Button size="lg" data-testid="button-media-contact">
            Contact Media Team
          </Button>
        </Card>
      </div>
    </div>
  );
}
