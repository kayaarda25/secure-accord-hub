
ALTER TABLE public.letterhead_settings
ADD COLUMN IF NOT EXISTS layout_data jsonb DEFAULT '{
  "elements": [
    {"id": "logo", "type": "image", "x": 40, "y": 30, "width": 120, "height": 60, "visible": true},
    {"id": "company_name", "type": "text", "x": 400, "y": 30, "width": 200, "height": 40, "fontSize": 22, "fontFamily": "sans-serif", "fontWeight": "bold", "textAlign": "right", "visible": true},
    {"id": "subtitle", "type": "text", "x": 400, "y": 70, "width": 200, "height": 24, "fontSize": 11, "fontFamily": "sans-serif", "fontWeight": "normal", "fontStyle": "italic", "textAlign": "right", "visible": true},
    {"id": "address", "type": "text", "x": 400, "y": 94, "width": 200, "height": 20, "fontSize": 9, "fontFamily": "sans-serif", "fontWeight": "normal", "textAlign": "right", "visible": true},
    {"id": "divider", "type": "line", "x": 40, "y": 120, "width": 555, "height": 2, "visible": true},
    {"id": "footer", "type": "text", "x": 40, "y": 800, "width": 555, "height": 20, "fontSize": 8, "fontFamily": "sans-serif", "fontWeight": "normal", "textAlign": "center", "visible": true}
  ]
}'::jsonb;
