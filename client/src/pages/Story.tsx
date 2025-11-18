import { Card } from "@/components/ui/card";
import { Heart, Lightbulb, Globe, Users } from "lucide-react";

export default function Story() {
  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="container max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-16">
          <Heart className="w-16 h-16 text-purple-600 mx-auto mb-4" />
          <h1 className="text-5xl font-bold mb-4">Our Story & Mission</h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            Revolutionizing pet care through innovation, technology, and love
          </p>
        </div>

        <div className="space-y-8">
          <Card className="p-8">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
              <Lightbulb className="w-8 h-8 text-yellow-500" />
              The Vision
            </h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              Pet Wash™ was born from a simple idea: every pet deserves access to premium care,
              and every pet owner deserves convenience. We've built the world's first integrated
              pet care ecosystem, connecting 8 different platforms under one unified experience.
            </p>
          </Card>

          <Card className="p-8">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
              <Globe className="w-8 h-8 text-blue-500" />
              Global Expansion
            </h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              From our roots in Israel and Australia, we're expanding to create a global network
              of premium pet care services. Our Octopus model connects stations, sitters, walkers,
              transport, training, and more - all accessible through one account.
            </p>
          </Card>

          <Card className="p-8">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
              <Users className="w-8 h-8 text-green-500" />
              Our Community
            </h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              We're building more than a business - we're creating a community of pet lovers,
              dedicated professionals, and innovative partners. Our 7-star loyalty program and
              VIP Club ensure that every member feels valued and supported.
            </p>
          </Card>

          <Card className="p-8 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 text-center">
            <h2 className="text-2xl font-bold mb-4">Join Our Journey</h2>
            <p className="text-gray-600 dark:text-gray-300">
              Be part of the pet care revolution. Together, we're making the world a better place for pets and their families.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
