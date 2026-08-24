import { Rocket, Twitter, Linkedin, Github } from 'lucide-react';

export default function Footer() {
  return (
    <>
      {/* Final CTA */}
      <section className="bg-white border-t border-gray-100 py-24 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-50 rounded-full blur-3xl opacity-50 -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-50 rounded-full blur-3xl opacity-50 translate-y-1/2 -translate-x-1/2"></div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6 tracking-tight">
            Stop Losing Customers Because You Forgot to Follow Up
          </h2>
          <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
            FollowFlow AI helps businesses track opportunities and turn conversations into customers.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => window.dispatchEvent(new Event('open-try-demo'))}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-full text-lg font-medium transition-all shadow-xl shadow-indigo-200"
            >
              Try Demo
            </button>
            <button 
              onClick={() => window.dispatchEvent(new Event('open-request-demo'))}
              className="bg-white hover:bg-gray-50 text-gray-900 border-2 border-gray-200 px-8 py-4 rounded-full text-lg font-medium transition-all"
            >
              Request Demo
            </button>
          </div>
        </div>
      </section>

      {/* Main Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <Rocket className="text-indigo-400 h-6 w-6" />
                <span className="text-xl font-bold text-white tracking-tight">FollowFlow AI</span>
              </div>
              <p className="text-gray-400 max-w-sm mb-6">
                Never Miss a Sales Opportunity. The smart AI assistant for modern sales teams and small businesses.
              </p>
              <div className="flex space-x-4">
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <Twitter className="h-5 w-5" />
                </a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <Linkedin className="h-5 w-5" />
                </a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <Github className="h-5 w-5" />
                </a>
              </div>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="/#features" className="hover:text-indigo-400 transition-colors">Features</a></li>
                <li><a href="/pricing" className="hover:text-indigo-400 transition-colors">Pricing</a></li>
                <li><a href="/login" className="hover:text-indigo-400 transition-colors">Login</a></li>
                <li><a href="/signup" className="hover:text-indigo-400 transition-colors">Sign Up</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="/about" className="hover:text-indigo-400 transition-colors">About Us</a></li>
                <li><a href="/contact" className="hover:text-indigo-400 transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-indigo-400 transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-indigo-400 transition-colors">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 pt-8 text-sm text-gray-500 flex flex-col md:flex-row justify-between items-center">
            <p>© {new Date().getFullYear()} FollowFlow AI Inc. All rights reserved.</p>
            <p className="mt-2 md:mt-0">Designed with ❤️ for Small Businesses</p>
          </div>
        </div>
      </footer>
    </>
  );
}
