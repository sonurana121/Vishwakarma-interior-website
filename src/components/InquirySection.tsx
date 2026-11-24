import { type FormEvent, useEffect, useState } from 'react';
import { CheckCircle2, Clock, MapPin, MessageCircle, Phone, Send } from 'lucide-react';
import { submitPublicInquiry } from '../lib/firestoreStore.ts';
import type { BusinessSettings, ServiceItem } from '../types.ts';

interface InquirySectionProps {
  services: ServiceItem[];
  settings: BusinessSettings;
  preselectedService?: string;
  preselectedProjectSlug?: string | null;
}

export function InquirySection({
  services,
  settings,
  preselectedService = '',
  preselectedProjectSlug = null,
}: InquirySectionProps) {
  const [customerName, setCustomerName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [location, setLocation] = useState('');
  const [serviceRequired, setServiceRequired] = useState(
    preselectedService || services[0]?.title || 'Home Interior Design'
  );
  const [projectDetails, setProjectDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submittedRecord, setSubmittedRecord] = useState<{
    name: string;
    service: string;
    location: string;
  } | null>(null);

  useEffect(() => {
    if (preselectedService) {
      setServiceRequired(preselectedService);
    }
  }, [preselectedService]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      await submitPublicInquiry({
        customer_name: customerName,
        mobile_number: mobileNumber,
        location,
        service_required: serviceRequired,
        project_details: projectDetails,
        project_ref_slug: preselectedProjectSlug,
      });
      setSubmittedRecord({
        name: customerName,
        service: serviceRequired,
        location,
      });
      setCustomerName('');
      setMobileNumber('');
      setLocation('');
      setProjectDetails('');
    } catch (err) {
      let friendly = 'Could not submit inquiry. Please verify your details or call us directly.';
      if (err instanceof Error) {
        try {
          const parsed = JSON.parse(err.message) as { error?: string };
          friendly = parsed.error || friendly;
        } catch {
          friendly = err.message;
        }
      }
      setErrorMsg(friendly);
    } finally {
      setSubmitting(false);
    }
  };

  const telHref = `tel:${settings.business_phone.replace(/\s+/g, '')}`;
  const defaultWhatsappHref = `https://wa.me/${settings.whatsapp_number}?text=${encodeURIComponent(
    'Hello Bipin Kumar (Vishwakarma Interior Services Centre), I would like to discuss an interior design or furniture project in Cuttack.'
  )}`;

  const submittedWhatsappHref = submittedRecord
    ? `https://wa.me/${settings.whatsapp_number}?text=${encodeURIComponent(
        `Hello Bipin Kumar, my name is ${submittedRecord.name}. I just submitted an inquiry on your website for ${submittedRecord.service} at ${submittedRecord.location}.`
      )}`
    : defaultWhatsappHref;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      <div className="lg:col-span-5 space-y-6">
        <div className="space-y-3">
          <p className="text-xs font-semibold text-[#9E6B3B] tracking-wide">
            Direct Consultation · Cuttack, Odisha
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold text-[#171614] tracking-tight leading-tight">
            Start Your Interior or Custom Furniture Project
          </h2>
          <p className="text-sm sm:text-base text-[#5C574F] leading-relaxed">
            Book an on-site measurement visit with Bipin Kumar anywhere in Cuttack, Choudwar, or Bhubaneswar. We provide transparent itemized quotations with material samples.
          </p>
        </div>

        <div className="space-y-4 pt-2 border-t border-[#E2DDD4]">
          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 text-[#9E6B3B] mt-1 shrink-0" />
            <div>
              <p className="text-xs font-medium text-[#5C574F]">Workshop &amp; Studio</p>
              <p className="text-sm font-medium text-[#171614]">{settings.workshop_address}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Clock className="w-4 h-4 text-[#9E6B3B] mt-1 shrink-0" />
            <div>
              <p className="text-xs font-medium text-[#5C574F]">Working Hours</p>
              <p className="text-sm font-medium text-[#171614]">{settings.working_hours}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <a
            href={defaultWhatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-[#2D5A3C] hover:bg-[#23472F] rounded-lg transition-colors whitespace-nowrap"
          >
            <MessageCircle className="w-4 h-4" />
            WhatsApp Direct Chat
          </a>
          <a
            href={telHref}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-[#171614] bg-white hover:bg-[#F1EFEA] border border-[#E2DDD4] rounded-lg transition-colors whitespace-nowrap tabular-nums"
          >
            <Phone className="w-4 h-4 text-[#9E6B3B]" />
            {settings.business_phone}
          </a>
        </div>
      </div>

      <div className="lg:col-span-7 bg-white border border-[#E2DDD4] rounded-xl p-6 sm:p-8">
        {submittedRecord ? (
          <div className="py-8 text-center space-y-4">
            <CheckCircle2 className="w-10 h-10 text-[#2D5A3C] mx-auto" />
            <h3 className="text-2xl font-semibold text-[#171614]">
              Inquiry Received — Thank You, {submittedRecord.name}
            </h3>
            <p className="text-sm text-[#5C574F] max-w-md mx-auto leading-relaxed">
              Your request for <span className="font-medium text-[#171614]">{submittedRecord.service}</span> in{' '}
              <span className="font-medium text-[#171614]">{submittedRecord.location}</span> has been saved. Bipin Kumar will call you to confirm a site visit.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <a
                href={submittedWhatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#2D5A3C] hover:bg-[#23472F] rounded-lg transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                Send Copy on WhatsApp
              </a>
              <button
                type="button"
                onClick={() => setSubmittedRecord(null)}
                className="px-5 py-2.5 text-sm font-medium text-[#171614] bg-[#F1EFEA] hover:bg-[#E5E1D8] rounded-lg transition-colors cursor-pointer"
              >
                Submit Another Inquiry
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center justify-between gap-4 pb-2 border-b border-[#EFECE6]">
              <h3 className="text-xl font-semibold text-[#171614]">Request a Free Site Visit &amp; Quote</h3>
              <span className="text-xs text-[#5C574F]">Response within 24 hours</span>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs font-medium text-[#991B1B]">
                {errorMsg}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="inq-name" className="block text-xs font-medium text-[#171614]">
                  Your Name
                </label>
                <input
                  id="inq-name"
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g., Rajesh Mohanty"
                  className="w-full px-3.5 py-2.5 text-sm bg-[#F9F8F6] border border-[#E2DDD4] rounded-lg focus:outline-none focus:border-[#9E6B3B]"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="inq-mobile" className="block text-xs font-medium text-[#171614]">
                  Mobile Number
                </label>
                <input
                  id="inq-mobile"
                  type="tel"
                  required
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  placeholder="10-digit mobile number"
                  className="w-full px-3.5 py-2.5 text-sm bg-[#F9F8F6] border border-[#E2DDD4] rounded-lg focus:outline-none focus:border-[#9E6B3B] tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="inq-location" className="block text-xs font-medium text-[#171614]">
                  Project Location / Area
                </label>
                <input
                  id="inq-location"
                  type="text"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., CDA Sector 9, Cuttack"
                  className="w-full px-3.5 py-2.5 text-sm bg-[#F9F8F6] border border-[#E2DDD4] rounded-lg focus:outline-none focus:border-[#9E6B3B]"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="inq-service" className="block text-xs font-medium text-[#171614]">
                  Required Service
                </label>
                <select
                  id="inq-service"
                  value={serviceRequired}
                  onChange={(e) => setServiceRequired(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-[#F9F8F6] border border-[#E2DDD4] rounded-lg focus:outline-none focus:border-[#9E6B3B]"
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.title}>
                      {s.title}
                    </option>
                  ))}
                  <option value="Full Turnkey Package">Full Turnkey Package</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="inq-details" className="block text-xs font-medium text-[#171614]">
                Project Details
              </label>
              <textarea
                id="inq-details"
                rows={4}
                value={projectDetails}
                onChange={(e) => setProjectDetails(e.target.value)}
                placeholder="Share your home size (e.g., 2BHK/3BHK), room dimensions, preferred wood finish, or timeline..."
                className="w-full px-3.5 py-2.5 text-sm bg-[#F9F8F6] border border-[#E2DDD4] rounded-lg focus:outline-none focus:border-[#9E6B3B]"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-[#171614] hover:bg-[#2E2B27] disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
            >
              <Send className="w-4 h-4" />
              {submitting ? 'Submitting Inquiry...' : 'Submit Inquiry'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
