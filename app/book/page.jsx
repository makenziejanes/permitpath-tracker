import BookingPage from '@/components/BookingPage';
import './book.css';

export const metadata = {
  title: 'Book a meeting · PermitPath',
  description: 'Pick a time to meet with Makenzie and Collin from PermitPath.',
};

export default function Book() {
  return <BookingPage />;
}
