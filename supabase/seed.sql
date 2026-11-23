BEGIN;

INSERT INTO public.customer (custno, custname, address, payterm, is_deleted)
VALUES
    ('D5C01', 'Demo Customer One', '1 Example Road, Sample City', 'COD', false),
    ('D5C02', 'Demo Customer Two', '2 Example Road, Sample City', '30D', false),
    ('D5C03', 'Sample Customer Old', '3 Example Road, Sample City', '45D', false);

INSERT INTO public.product (prodcode, description, unit, is_deleted)
VALUES
    ('D5P001', 'Demo Widget Alpha', 'ea', false),
    ('D5P002', 'Demo Future Item', 'pc', false),
    ('D5P003', 'Demo No Price Item', 'mtr', false),
    ('D5P004', 'Demo Inactive Item', 'pkg', false),
    ('D5P005', 'Demo Liquid Item', 'ltr', false);

-- Fixed dates support repeatable as-of checks without depending on the run date.
INSERT INTO public.pricehist (effdate, prodcode, unitprice, is_deleted)
VALUES
    (DATE '2024-01-01', 'D5P001', 10.00, false),
    (DATE '2024-07-01', 'D5P001', 12.50, false),
    (DATE '2024-10-01', 'D5P001', 11.00, true),
    (DATE '2035-01-01', 'D5P001', 15.00, false),
    (DATE '2035-01-01', 'D5P002', 99.00, false),
    (DATE '2024-01-01', 'D5P004', 5.00, true),
    (DATE '2024-01-01', 'D5P005', 7.99, false);

-- DBA-04 permits deactivation only after all child history rows are inactive.
UPDATE public.customer
   SET is_deleted = true
 WHERE custno = 'D5C03';

UPDATE public.product
   SET is_deleted = true
 WHERE prodcode = 'D5P004';

COMMIT;
