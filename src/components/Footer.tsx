import React from 'react';
import { Link } from 'react-router-dom';

const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-900 text-white py-12 border-t border-gray-800">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center space-x-2 mb-6">
              <img 
                src="/logod.png" 
                alt="DREEMYSTAR Logo" 
                className="h-16 w-16"
              />
              <span className="text-xl font-bold">DREEMYSTAR</span>
            </div>
            <p className="text-gray-400">
              Your gateway to premium live concert streaming experiences.
            </p>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li><Link to="/" className="text-gray-400 hover:text-yellow-400 transition-colors">Home</Link></li>
              <li><Link to="/live-events" className="text-gray-400 hover:text-yellow-400 transition-colors">Live Events</Link></li>
              <li><Link to="/upcoming-concerts" className="text-gray-400 hover:text-yellow-400 transition-colors">Upcoming Concerts</Link></li>
              <li><Link to="/categories" className="text-gray-400 hover:text-yellow-400 transition-colors">Categories</Link></li>
              <li><Link to="/help" className="text-gray-400 hover:text-yellow-400 transition-colors">Help Center</Link></li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-4">Browse By</h3>
            <ul className="space-y-2">
              <li><Link to="/categories?genre=Music" className="text-gray-400 hover:text-yellow-400 transition-colors">Music</Link></li>
              <li><Link to="/categories?genre=Comedy" className="text-gray-400 hover:text-yellow-400 transition-colors">Comedy</Link></li>
              <li><Link to="/categories?genre=African" className="text-gray-400 hover:text-yellow-400 transition-colors">African</Link></li>
              <li><Link to="/categories?genre=European" className="text-gray-400 hover:text-yellow-400 transition-colors">European</Link></li>
              <li><Link to="/categories?genre=American" className="text-gray-400 hover:text-yellow-400 transition-colors">American</Link></li>
              <li><Link to="/categories?genre=Asian" className="text-gray-400 hover:text-yellow-400 transition-colors">Asian</Link></li>
              <li><Link to="/categories?genre=Maghreb" className="text-gray-400 hover:text-yellow-400 transition-colors">Maghreb</Link></li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-4">Contact</h3>
            <ul className="space-y-2">
              <li className="text-gray-400">Email: contact@dreemystar.com</li>
            
              <li className="text-gray-400">Address: NY, United States of America</li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-gray-800 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-gray-400 text-sm">
            © {new Date().getFullYear()} DREEMYSTAR.COM All rights reserved.
          </p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <a href="#" className="text-gray-400 hover:text-yellow-400">Terms of Service</a>
            <a href="#" className="text-gray-400 hover:text-yellow-400">Privacy Policy</a>
            <a href="#" className="text-gray-400 hover:text-yellow-400">Cookie Policy</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;