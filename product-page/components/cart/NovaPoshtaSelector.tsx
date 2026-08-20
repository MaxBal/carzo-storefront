'use client';

import { useEffect, useId, useState } from 'react';
import { Check, ChevronDown, Loader2, MapPin, Search } from 'lucide-react';
import type {
  CheckoutDelivery,
  DeliveryMethod,
  NovaPoshtaCity,
  NovaPoshtaPoint,
  NovaPoshtaStreet,
} from '@/lib/cart/types';

interface NovaPoshtaSelectorProps {
  allowPostomat: boolean;
  value: CheckoutDelivery;
  showErrors: boolean;
  onChange: (delivery: CheckoutDelivery) => void;
}

type TouchedField = 'city' | 'point' | 'street' | 'house';

const DELIVERY_METHODS: Array<{ value: DeliveryMethod; label: string }> = [
  { value: 'BRANCH', label: 'У відділення' },
  { value: 'COURIER', label: "Кур'єром" },
  { value: 'POSTOMAT', label: 'У поштомат' },
];

const INPUT_BASE = 'h-12 w-full rounded-xl border bg-white px-3 text-base outline-none transition focus:border-gray-500 sm:text-sm';

function deliveryForMethod(method: DeliveryMethod, cityRef: string): CheckoutDelivery {
  if (method === 'COURIER') {
    return { method, cityRef, streetRef: '', streetName: '', house: '', apartment: '' };
  }
  return { method, cityRef, pointRef: '' };
}

function isPointDelivery(delivery: CheckoutDelivery): delivery is Extract<CheckoutDelivery, { method: 'BRANCH' | 'POSTOMAT' }> {
  return delivery.method === 'BRANCH' || delivery.method === 'POSTOMAT';
}

function useActiveOptionVisibility(listboxId: string, optionId: string | null) {
  useEffect(() => {
    if (!optionId) return;
    const frame = window.requestAnimationFrame(() => {
      const listbox = document.getElementById(listboxId);
      const option = document.getElementById(optionId);
      if (!listbox || !option) return;

      const listboxRect = listbox.getBoundingClientRect();
      const optionRect = option.getBoundingClientRect();
      if (optionRect.top < listboxRect.top) {
        listbox.scrollTop -= listboxRect.top - optionRect.top;
      } else if (optionRect.bottom > listboxRect.bottom) {
        listbox.scrollTop += optionRect.bottom - listboxRect.bottom;
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [listboxId, optionId]);
}

export default function NovaPoshtaSelector({
  allowPostomat,
  value,
  showErrors,
  onChange,
}: NovaPoshtaSelectorProps) {
  const id = useId();
  const [cityQuery, setCityQuery] = useState('');
  const [pointQuery, setPointQuery] = useState('');
  const [streetQuery, setStreetQuery] = useState('');
  const [cities, setCities] = useState<NovaPoshtaCity[]>([]);
  const [points, setPoints] = useState<NovaPoshtaPoint[]>([]);
  const [streets, setStreets] = useState<NovaPoshtaStreet[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<NovaPoshtaPoint | null>(null);
  const [cityLoading, setCityLoading] = useState(false);
  const [pointLoading, setPointLoading] = useState(false);
  const [streetLoading, setStreetLoading] = useState(false);
  const [citySearched, setCitySearched] = useState(false);
  const [pointLoaded, setPointLoaded] = useState(false);
  const [streetSearched, setStreetSearched] = useState(false);
  const [cityError, setCityError] = useState<string | null>(null);
  const [pointError, setPointError] = useState<string | null>(null);
  const [streetError, setStreetError] = useState<string | null>(null);
  const [cityActiveIndex, setCityActiveIndex] = useState(-1);
  const [pointActiveIndex, setPointActiveIndex] = useState(-1);
  const [streetActiveIndex, setStreetActiveIndex] = useState(-1);
  const [pointOpen, setPointOpen] = useState(false);
  const [pointRetry, setPointRetry] = useState(0);
  const [touched, setTouched] = useState<Partial<Record<TouchedField, boolean>>>({});

  useActiveOptionVisibility(
    `${id}-city-listbox`,
    cityActiveIndex >= 0 ? `${id}-city-option-${cityActiveIndex}` : null,
  );
  useActiveOptionVisibility(
    `${id}-point-listbox`,
    pointOpen && pointActiveIndex >= 0 ? `${id}-point-option-${pointActiveIndex}` : null,
  );
  useActiveOptionVisibility(
    `${id}-street-listbox`,
    streetActiveIndex >= 0 ? `${id}-street-option-${streetActiveIndex}` : null,
  );

  const markTouched = (field: TouchedField) => {
    setTouched(current => ({ ...current, [field]: true }));
  };

  const invalid = (field: TouchedField, isMissing: boolean) => isMissing && (showErrors || Boolean(touched[field]));
  const cityInvalid = invalid('city', !value.cityRef);
  const pointInvalid = isPointDelivery(value) && invalid('point', !value.pointRef);
  const streetInvalid = value.method === 'COURIER' && invalid('street', !value.streetRef || !value.streetName.trim());
  const houseInvalid = value.method === 'COURIER' && invalid('house', !value.house.trim());

  useEffect(() => {
    if (cityQuery.trim().length < 2 || value.cityRef) {
      setCities([]);
      setCitySearched(false);
      setCityLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setCityLoading(true);
      setCityError(null);
      setCitySearched(false);
      try {
        const response = await fetch(`/api/nova-poshta/cities?q=${encodeURIComponent(cityQuery.trim())}`, {
          signal: controller.signal,
        });
        const payload = await response.json() as NovaPoshtaCity[] | { error?: string };
        if (!response.ok || !Array.isArray(payload)) {
          throw new Error(Array.isArray(payload) ? undefined : payload.error);
        }
        setCities(payload);
        setCityActiveIndex(payload.length > 0 ? 0 : -1);
        setCitySearched(true);
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setCityError(requestError instanceof Error ? requestError.message : 'Не вдалося знайти місто.');
          setCitySearched(true);
        }
      } finally {
        if (!controller.signal.aborted) setCityLoading(false);
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [cityQuery, value.cityRef]);

  useEffect(() => {
    if (!isPointDelivery(value) || !value.cityRef || !pointOpen) {
      setPoints([]);
      setPointLoaded(false);
      setPointLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setPointLoading(true);
      setPointError(null);
      setPointLoaded(false);
      try {
        const params = new URLSearchParams({
          city: value.cityRef,
          method: value.method,
          q: pointQuery.trim(),
        });
        const response = await fetch(`/api/nova-poshta/points?${params}`, { signal: controller.signal });
        const payload = await response.json() as NovaPoshtaPoint[] | { error?: string };
        if (!response.ok || !Array.isArray(payload)) {
          throw new Error(Array.isArray(payload) ? undefined : payload.error);
        }
        setPoints(payload);
        setPointActiveIndex(payload.length > 0 ? 0 : -1);
        setPointLoaded(true);
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setPointError(requestError instanceof Error ? requestError.message : 'Не вдалося завантажити точки доставки.');
          setPointLoaded(true);
        }
      } finally {
        if (!controller.signal.aborted) setPointLoading(false);
      }
    }, pointQuery.trim() ? 300 : 0);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [pointOpen, pointQuery, pointRetry, value]);

  useEffect(() => {
    if (value.method !== 'COURIER' || !value.cityRef || value.streetRef || streetQuery.trim().length < 2) {
      setStreets([]);
      setStreetSearched(false);
      setStreetLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setStreetLoading(true);
      setStreetError(null);
      setStreetSearched(false);
      try {
        const params = new URLSearchParams({ city: value.cityRef, q: streetQuery.trim() });
        const response = await fetch(`/api/nova-poshta/streets?${params}`, { signal: controller.signal });
        const payload = await response.json() as NovaPoshtaStreet[] | { error?: string };
        if (!response.ok || !Array.isArray(payload)) {
          throw new Error(Array.isArray(payload) ? undefined : payload.error);
        }
        setStreets(payload);
        setStreetActiveIndex(payload.length > 0 ? 0 : -1);
        setStreetSearched(true);
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setStreetError(requestError instanceof Error ? requestError.message : 'Не вдалося знайти вулицю.');
          setStreetSearched(true);
        }
      } finally {
        if (!controller.signal.aborted) setStreetLoading(false);
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [streetQuery, value]);

  useEffect(() => {
    if (value.method === 'POSTOMAT' && !allowPostomat) {
      setSelectedPoint(null);
      setPointOpen(false);
      setPointQuery('');
      onChange(deliveryForMethod('BRANCH', value.cityRef));
    }
  }, [allowPostomat, onChange, value]);

  const changeMethod = (method: DeliveryMethod) => {
    if (method === 'POSTOMAT' && !allowPostomat) return;
    setSelectedPoint(null);
    setPointOpen(false);
    setPointQuery('');
    setPointActiveIndex(-1);
    setPoints([]);
    setStreetQuery('');
    setStreetActiveIndex(-1);
    setStreets([]);
    setTouched(current => ({ city: current.city }));
    onChange(deliveryForMethod(method, value.cityRef));
  };

  const changeCityQuery = (query: string) => {
    setCityQuery(query);
    setCityActiveIndex(-1);
    setSelectedPoint(null);
    setPointOpen(false);
    setPointQuery('');
    setPointActiveIndex(-1);
    setStreetQuery('');
    setStreetActiveIndex(-1);
    setPoints([]);
    setStreets([]);
    onChange(deliveryForMethod(value.method, ''));
  };

  const chooseCity = (city: NovaPoshtaCity) => {
    setCityQuery(`${city.name}${city.area ? `, ${city.area} обл.` : ''}`);
    setCityActiveIndex(-1);
    setCities([]);
    setCityError(null);
    setSelectedPoint(null);
    setPointOpen(false);
    setPointQuery('');
    setPointActiveIndex(-1);
    setStreetQuery('');
    setStreetActiveIndex(-1);
    setTouched(current => ({ ...current, city: true, point: false, street: false, house: false }));
    onChange(deliveryForMethod(value.method, city.ref));
  };

  const choosePoint = (point: NovaPoshtaPoint) => {
    if (!isPointDelivery(value)) return;
    setSelectedPoint(point);
    setPointOpen(false);
    setPointQuery('');
    setPointActiveIndex(-1);
    setPoints([]);
    setPointError(null);
    setTouched(current => ({ ...current, point: true }));
    onChange({ ...value, pointRef: point.ref });
  };

  const chooseStreet = (street: NovaPoshtaStreet) => {
    if (value.method !== 'COURIER') return;
    setStreetQuery(street.name);
    setStreetActiveIndex(-1);
    setStreets([]);
    setStreetError(null);
    setTouched(current => ({ ...current, street: true }));
    onChange({ ...value, streetRef: street.ref, streetName: street.name });
  };

  const pointLabel = value.method === 'POSTOMAT' ? 'Поштомат *' : 'Відділення *';
  const pointPlaceholder = value.method === 'POSTOMAT' ? 'Виберіть поштомат' : 'Виберіть відділення';
  const pointSearchPlaceholder = value.method === 'POSTOMAT'
    ? 'Введіть номер або адресу поштомату'
    : 'Введіть номер або адресу відділення';

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-1.5 block text-sm font-medium text-gray-900">Спосіб доставки *</legend>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Спосіб доставки">
          {DELIVERY_METHODS.map(method => {
            const selected = value.method === method.value;
            const disabled = method.value === 'POSTOMAT' && !allowPostomat;
            return (
              <button
                key={method.value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                tabIndex={selected ? 0 : -1}
                data-delivery-method={method.value}
                title={disabled ? 'Для цього замовлення поштомат недоступний' : undefined}
                onClick={() => changeMethod(method.value)}
                onKeyDown={event => {
                  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
                  event.preventDefault();
                  const available = DELIVERY_METHODS.filter(option => option.value !== 'POSTOMAT' || allowPostomat);
                  const currentIndex = available.findIndex(option => option.value === value.method);
                  const nextIndex = event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? available.length - 1
                      : (currentIndex + (event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1) + available.length) % available.length;
                  const nextMethod = available[nextIndex]?.value;
                  if (!nextMethod) return;
                  const group = event.currentTarget.parentElement;
                  changeMethod(nextMethod);
                  window.requestAnimationFrame(() => {
                    group?.querySelector<HTMLButtonElement>(`[data-delivery-method="${nextMethod}"]`)
                      ?.focus();
                  });
                }}
                className={`min-h-11 rounded-xl border px-2 py-2 text-xs font-medium leading-4 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 ${
                  selected
                    ? 'border-black bg-black text-white'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400'
                }`}
              >
                {method.label}
              </button>
            );
          })}
        </div>
        {!allowPostomat && (
          <p className="mt-2 text-xs leading-5 text-gray-500">Для цього замовлення доступна доставка у відповідне відділення або курʼєром.</p>
        )}
      </fieldset>

      <div data-keyboard-dropdown>
        <label htmlFor={`${id}-city`} className="mb-1.5 block text-sm font-medium text-gray-900">Місто *</label>
        <div className="relative">
          <MapPin aria-hidden="true" className="absolute left-3 top-3.5 text-gray-400" size={17} />
          <input
            id={`${id}-city`}
            value={cityQuery}
            onChange={event => changeCityQuery(event.target.value)}
            onBlur={() => markTouched('city')}
            onKeyDown={event => {
              if (event.key === 'Escape') {
                setCities([]);
                setCityActiveIndex(-1);
                return;
              }
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                if (cities.length === 0) return;
                event.preventDefault();
                setCityActiveIndex(current => (
                  event.key === 'ArrowDown'
                    ? (current + 1 + cities.length) % cities.length
                    : (current - 1 + cities.length) % cities.length
                ));
                return;
              }
              if (event.key === 'Enter' && cityActiveIndex >= 0 && cities[cityActiveIndex]) {
                event.preventDefault();
                chooseCity(cities[cityActiveIndex]);
              }
            }}
            placeholder="Почніть вводити місто"
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={cities.length > 0}
            aria-controls={cities.length > 0 ? `${id}-city-listbox` : undefined}
            aria-activedescendant={cityActiveIndex >= 0 ? `${id}-city-option-${cityActiveIndex}` : undefined}
            aria-invalid={cityInvalid}
            aria-describedby={cityInvalid ? `${id}-city-error` : undefined}
            className={`${INPUT_BASE} pl-10 pr-10 ${cityInvalid ? 'border-red-400 focus:border-red-500' : 'border-gray-200'}`}
          />
          {cityLoading && <Loader2 aria-label="Завантаження міст" className="absolute right-3 top-3.5 animate-spin text-gray-400" size={17} />}
          {value.cityRef && <Check aria-hidden="true" className="absolute right-3 top-3.5 text-[#159e85]" size={17} />}
        </div>
        {cityInvalid && <p id={`${id}-city-error`} className="mt-1.5 text-xs text-red-600">Оберіть місто зі списку.</p>}
        {cities.length > 0 && (
          <div id={`${id}-city-listbox`} className="mt-1 max-h-56 overflow-y-auto overscroll-contain rounded-xl border border-gray-200 bg-white p-1 shadow-xl" role="listbox" aria-label="Міста Нової пошти">
            {cities.map((city, index) => (
              <button key={city.ref} id={`${id}-city-option-${index}`} type="button" role="option" aria-selected={index === cityActiveIndex} onMouseEnter={() => setCityActiveIndex(index)} onClick={() => chooseCity(city)} className="w-full rounded-lg px-3 py-2.5 text-left text-sm hover:bg-gray-100 focus-visible:bg-gray-100 focus-visible:outline-none aria-selected:bg-gray-100">
                <span className="font-medium">{city.type} {city.name}</span>
                {city.area && <span className="ml-1 text-gray-500">({city.area} обл.)</span>}
              </button>
            ))}
          </div>
        )}
        {citySearched && !cityLoading && !cityError && cities.length === 0 && !value.cityRef && (
          <p className="mt-2 text-sm text-gray-500">Місто не знайдено. Уточніть запит.</p>
        )}
        {cityError && <p className="mt-2 text-sm text-red-600">{cityError}</p>}
      </div>

      {isPointDelivery(value) && (
        <div data-keyboard-dropdown>
          <label id={`${id}-point-label`} className="mb-1.5 block text-sm font-medium text-gray-900">{pointLabel}</label>
          <button
            type="button"
            role="combobox"
            disabled={!value.cityRef}
            aria-haspopup="listbox"
            aria-expanded={pointOpen}
            aria-controls={pointOpen ? `${id}-point-listbox` : undefined}
            aria-labelledby={`${id}-point-label ${id}-point-value`}
            aria-invalid={pointInvalid}
            aria-describedby={pointInvalid ? `${id}-point-error` : undefined}
            onBlur={event => {
              const container = event.currentTarget.closest('[data-keyboard-dropdown]');
              if (event.relatedTarget instanceof Node && container?.contains(event.relatedTarget)) return;
              markTouched('point');
            }}
            onClick={() => {
              setPointOpen(open => !open);
              setPointQuery('');
              setPointActiveIndex(-1);
              setPointError(null);
            }}
            className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border bg-white px-3 text-left text-base outline-none transition focus:border-gray-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 sm:text-sm ${pointInvalid ? 'border-red-400' : 'border-gray-200'}`}
          >
            <span id={`${id}-point-value`} className={selectedPoint ? 'text-gray-900' : 'text-gray-400'}>{selectedPoint?.name || pointPlaceholder}</span>
            <ChevronDown aria-hidden="true" className={`shrink-0 text-gray-400 transition-transform ${pointOpen ? 'rotate-180' : ''}`} size={18} />
          </button>
          {pointInvalid && <p id={`${id}-point-error`} className="mt-1.5 text-xs text-red-600">{pointPlaceholder}.</p>}

          {pointOpen && value.cityRef && (
            <div className="mt-1 rounded-xl border border-gray-200 bg-white p-1 shadow-xl">
              <div className="relative m-1">
                <Search aria-hidden="true" className="absolute left-3 top-3.5 text-gray-400" size={17} />
                <input
                  value={pointQuery}
                  onChange={event => {
                    setPointQuery(event.target.value);
                    setPointActiveIndex(-1);
                  }}
                  onKeyDown={event => {
                    if (event.key === 'Escape') {
                      setPointOpen(false);
                      setPointActiveIndex(-1);
                      return;
                    }
                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                      if (points.length === 0) return;
                      event.preventDefault();
                      setPointActiveIndex(current => (
                        event.key === 'ArrowDown'
                          ? (current + 1 + points.length) % points.length
                          : (current - 1 + points.length) % points.length
                      ));
                      return;
                    }
                    if (event.key === 'Enter' && pointActiveIndex >= 0 && points[pointActiveIndex]) {
                      event.preventDefault();
                      choosePoint(points[pointActiveIndex]);
                    }
                  }}
                  placeholder={pointSearchPlaceholder}
                  autoComplete="off"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={true}
                  aria-controls={`${id}-point-listbox`}
                  aria-activedescendant={pointActiveIndex >= 0 ? `${id}-point-option-${pointActiveIndex}` : undefined}
                  className="h-12 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-10 text-base outline-none focus:border-gray-500 sm:text-sm"
                />
                {pointLoading && <Loader2 aria-label="Завантаження точок доставки" className="absolute right-3 top-3.5 animate-spin text-gray-400" size={17} />}
              </div>
              <div id={`${id}-point-listbox`} className="max-h-56 overflow-y-auto overscroll-contain" role="listbox" aria-label={pointLabel}>
                {points.map((point, index) => (
                  <button key={point.ref} id={`${id}-point-option-${index}`} type="button" role="option" aria-selected={point.ref === value.pointRef} onMouseEnter={() => setPointActiveIndex(index)} onClick={() => choosePoint(point)} className={`w-full rounded-lg px-3 py-2.5 text-left hover:bg-gray-100 focus-visible:bg-gray-100 focus-visible:outline-none aria-selected:bg-gray-100 ${index === pointActiveIndex ? 'bg-gray-100' : ''}`}>
                    <span className="block text-sm font-medium">{point.name}</span>
                    {point.address !== point.name && <span className="mt-0.5 block text-xs text-gray-500">{point.address}</span>}
                  </button>
                ))}
                {pointLoaded && !pointLoading && !pointError && points.length === 0 && (
                  <p className="px-3 py-5 text-center text-sm text-gray-500">Нічого не знайдено. Уточніть номер або адресу.</p>
                )}
                {pointError && (
                  <div className="px-3 py-4 text-center">
                    <p className="text-sm text-red-600">{pointError}</p>
                    <button type="button" onClick={() => setPointRetry(current => current + 1)} className="mt-2 text-sm font-medium text-gray-900 underline underline-offset-2">Спробувати ще раз</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {value.method === 'COURIER' && (
        <div className="space-y-4">
          <div data-keyboard-dropdown>
            <label htmlFor={`${id}-street`} className="mb-1.5 block text-sm font-medium text-gray-900">Вулиця *</label>
            <div className="relative">
              <input
                id={`${id}-street`}
                value={streetQuery}
                disabled={!value.cityRef}
                onBlur={event => {
                  const container = event.currentTarget.closest('[data-keyboard-dropdown]');
                  if (event.relatedTarget instanceof Node && container?.contains(event.relatedTarget)) return;
                  markTouched('street');
                }}
                onChange={event => {
                  const query = event.target.value;
                  setStreetQuery(query);
                  setStreetActiveIndex(-1);
                  onChange({ ...value, streetRef: '', streetName: query });
                }}
                onKeyDown={event => {
                  if (event.key === 'Escape') {
                    setStreets([]);
                    setStreetActiveIndex(-1);
                    return;
                  }
                  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    if (streets.length === 0) return;
                    event.preventDefault();
                    setStreetActiveIndex(current => (
                      event.key === 'ArrowDown'
                        ? (current + 1 + streets.length) % streets.length
                        : (current - 1 + streets.length) % streets.length
                    ));
                    return;
                  }
                  if (event.key === 'Enter' && streetActiveIndex >= 0 && streets[streetActiveIndex]) {
                    event.preventDefault();
                    chooseStreet(streets[streetActiveIndex]);
                  }
                }}
                placeholder={value.cityRef ? 'Почніть вводити вулицю' : 'Спочатку оберіть місто'}
                autoComplete="street-address"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={streets.length > 0}
                aria-controls={streets.length > 0 ? `${id}-street-listbox` : undefined}
                aria-activedescendant={streetActiveIndex >= 0 ? `${id}-street-option-${streetActiveIndex}` : undefined}
                aria-invalid={streetInvalid}
                className={`${INPUT_BASE} pr-10 disabled:bg-gray-100 ${streetInvalid ? 'border-red-400 focus:border-red-500' : 'border-gray-200'}`}
              />
              {streetLoading && <Loader2 aria-label="Завантаження вулиць" className="absolute right-3 top-3.5 animate-spin text-gray-400" size={17} />}
              {value.streetRef && <Check aria-hidden="true" className="absolute right-3 top-3.5 text-[#159e85]" size={17} />}
            </div>
            {streetInvalid && <p className="mt-1.5 text-xs text-red-600">Оберіть вулицю зі списку.</p>}
            {streets.length > 0 && (
              <div id={`${id}-street-listbox`} className="mt-1 max-h-52 overflow-y-auto overscroll-contain rounded-xl border border-gray-200 bg-white p-1 shadow-xl" role="listbox" aria-label="Вулиці Нової пошти">
                {streets.map((street, index) => (
                  <button key={street.ref} id={`${id}-street-option-${index}`} type="button" role="option" aria-selected={index === streetActiveIndex || street.ref === value.streetRef} onMouseEnter={() => setStreetActiveIndex(index)} onClick={() => chooseStreet(street)} className="w-full rounded-lg px-3 py-2.5 text-left text-sm hover:bg-gray-100 focus-visible:bg-gray-100 focus-visible:outline-none aria-selected:bg-gray-100">
                    <span className="font-medium">{street.type} {street.name}</span>
                  </button>
                ))}
              </div>
            )}
            {streetSearched && !streetLoading && !streetError && streets.length === 0 && !value.streetRef && streetQuery.trim().length >= 2 && (
              <p className="mt-2 text-sm text-gray-500">Вулицю не знайдено. Уточніть запит.</p>
            )}
            {streetError && <p className="mt-2 text-sm text-red-600">{streetError}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="mb-1.5 block text-sm font-medium text-gray-900">Будинок *</span>
              <input
                value={value.house}
                onBlur={() => markTouched('house')}
                onChange={event => onChange({ ...value, house: event.target.value })}
                maxLength={30}
                autoComplete="address-line2"
                aria-invalid={houseInvalid}
                className={`${INPUT_BASE} ${houseInvalid ? 'border-red-400 focus:border-red-500' : 'border-gray-200'}`}
              />
              {houseInvalid && <span className="mt-1.5 block text-xs text-red-600">Вкажіть номер будинку.</span>}
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-medium text-gray-900">Квартира</span>
              <input
                value={value.apartment || ''}
                onChange={event => onChange({ ...value, apartment: event.target.value })}
                maxLength={30}
                autoComplete="address-line3"
                className={`${INPUT_BASE} border-gray-200`}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
