import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Briefcase, Users, Heart, TrendingUp } from "lucide-react";

export default function Careers() {
  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="container max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-16">
          <Briefcase className="w-16 h-16 text-purple-600 mx-auto mb-4" />
          <h1 className="text-5xl font-bold mb-4">Careers at Pet Wash™</h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            Join a team that's revolutionizing pet care globally
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <Card className="p-6">
            <Heart className="w-12 h-12 text-red-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Mission-Driven Work</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Make a real difference in the lives of pets and their families every single day
            </p>
          </Card>

          <Card className="p-6">
            <TrendingUp className="w-12 h-12 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Growth Opportunities</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Expand your skills across 8 platforms in a rapidly growing global company
            </p>
          </Card>

          <Card className="p-6">
            <Users className="w-12 h-12 text-blue-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Amazing Team</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Work with passionate, talented people who love pets as much as you do
            </p>
          </Card>

          <Card className="p-6">
            <Briefcase className="w-12 h-12 text-purple-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Competitive Benefits</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Comprehensive benefits, competitive salary, and employee perks
            </p>
          </Card>
        </div>

        <Card className="p-8 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 text-center">
          <h2 className="text-2xl font-bold mb-4">Open Positions</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Explore opportunities across technology, operations, franchise support, and more
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" data-testid="button-view-jobs">
              View Open Positions
            </Button>
            <Button size="lg" variant="outline" data-testid="button-staff-application" onClick={() => window.location.href = "/staff/application"}>
              Staff Application
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
