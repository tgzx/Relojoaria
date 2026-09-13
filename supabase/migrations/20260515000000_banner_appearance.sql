begin;

alter table public.banners
  add column if not exists theme_preset text default 'classic-night',
  add column if not exists image_position text default 'center center',
  add column if not exists image_fit text default 'cover',
  add column if not exists image_brightness numeric(4,2) default 0.92,
  add column if not exists image_contrast numeric(4,2) default 1.05,
  add column if not exists overlay_strength numeric(4,2) default 0.56;

update public.banners
set
  theme_preset = coalesce(theme_preset, 'classic-night'),
  image_position = coalesce(image_position, 'center center'),
  image_fit = case
    when image_fit in ('cover', 'contain') then image_fit
    else 'cover'
  end,
  image_brightness = coalesce(image_brightness, 0.92),
  image_contrast = coalesce(image_contrast, 1.05),
  overlay_strength = coalesce(overlay_strength, 0.56),
  updated_at = now();

alter table public.banners
  alter column theme_preset set default 'classic-night',
  alter column image_position set default 'center center',
  alter column image_fit set default 'cover',
  alter column image_brightness set default 0.92,
  alter column image_contrast set default 1.05,
  alter column overlay_strength set default 0.56;

alter table public.banners
  alter column theme_preset set not null,
  alter column image_position set not null,
  alter column image_fit set not null,
  alter column image_brightness set not null,
  alter column image_contrast set not null,
  alter column overlay_strength set not null;

alter table public.banners
  drop constraint if exists banners_image_fit_check;

alter table public.banners
  add constraint banners_image_fit_check
  check (image_fit in ('cover', 'contain'));

commit;