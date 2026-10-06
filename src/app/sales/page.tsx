import { redirect } from 'next/navigation';
import { SALES_HOME_PATH } from '../lib/salesNav';

export default function SalesIndexPage() {
  redirect(SALES_HOME_PATH);
}
