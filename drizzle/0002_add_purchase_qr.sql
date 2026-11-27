-- Сэтгэлийн Одод — 0002: худалдан авалт дээр QPay QR мэдээлэл хадгалах.
-- Ингэснээр төлбөрийн хуудсыг дахин нээхэд өмнө үүсгэсэн QR дахин харагдана.
-- Хэрэглээ: npm run db:migrate

ALTER TABLE purchases ADD COLUMN IF NOT EXISTS qpay_qr_text TEXT;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS qpay_qr_image TEXT;
