import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { Features } from './components/Features';
import { Examples } from './components/Examples';
import { HowItWorks } from './components/HowItWorks';
import { Footer } from './components/Footer';

export default function App() {
  return (
    <div className="min-h-screen">
      <Header />
      <Hero />
      <Features />
      <Examples />
      <HowItWorks />
      <Footer />
    </div>
  );
}