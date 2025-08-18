/**
 * AUP GRAB FOOD - Google Apps Script Backend
 * Real-time Food Booking and Delivery Tracking System
 */

// Configuration
const BOOKING_SHEETS = {
  food: 'FoodBookings',
  parcel: 'ParcelsBookings',
  laundry: 'LaundryBookings'
};
const RIDERS_SHEET_NAME = 'Riders';
const DELIVERY_SHEET_NAME = 'Deliveries';
const MESSAGES_SHEET_NAME = 'Messages';

/**
 * Utility: standard JSON response
 */
function createResponse(success, message, extra) {
  const payload = Object.assign({ success: !!success, message: message || '' }, extra || {});
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Utility: generate unique order ID
 */
function generateOrderId() {
  const ts = new Date();
  const pad = n => n.toString().padStart(2, '0');
  const datePart = `${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}-${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}`;
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ORD-${datePart}-${rand}`;
}

/**
 * Main function to handle all HTTP requests
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createResponse(false, 'Empty request body');
    }

    let data;
    const raw = e.postData.contents;
    // Try JSON first, then fallback to URL-encoded
    try {
      data = JSON.parse(raw);
    } catch (err) {
      // Fallback: parse key=value&key2=value2
      data = {};
      raw.split('&').forEach(pair => {
        const [k, v] = pair.split('=');
        if (k) data[decodeURIComponent(k)] = decodeURIComponent(v || '');
      });
    }

    const action = data.action;
    
    switch(action) {
      case 'submitBooking':
        return submitBooking(data);
      case 'submit_booking':
        return submitBookingCompat(data); // frontend compatibility
      case 'getOrderStatus':
        return getOrderStatus(data.sessionId);
      case 'assignRider':
        return assignRider(data);
      case 'assign_rider': // frontend rider dashboard compatibility
        return assignRider({
          orderId: data.order_id,
          riderId: data.rider_id,
          riderName: data.rider_name,
          riderPhone: data.rider_phone
        });
      case 'updateDeliveryStatus':
        return updateDeliveryStatus(data);
      case 'confirmDelivery':
        return confirmDelivery(data);
      case 'complete_booking':
        return completeBookingCompat(data); // frontend compatibility
      case 'send_message':
        return sendMessage(data);
      case 'cancel_booking':
        return cancelBookingCompat(data);
      default:
        return createResponse(false, 'Invalid action');
    }
  } catch (error) {
    console.error('Error in doPost:', error);
    return createResponse(false, 'Server error: ' + (error && error.message ? error.message : error));
  }
}

/**
 * Utility: find order across all booking sheets
 */
function findOrderRow(orderId) {
  const types = Object.keys(BOOKING_SHEETS);
  for (let t of types) {
    const sheet = getOrCreateSheet(BOOKING_SHEETS[t]);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === orderId) {
        return { sheet, index: i + 1, row: data[i], type: t };
      }
    }
  }
  return null;
}

/**
 * Assign rider to an order across booking sheets
 */
function assignRider(data) {
  try {
    const orderId = data.orderId || data.order_id;
    const riderId = data.riderId || data.rider_id;
    const riderName = data.riderName || data.rider_name;
    const riderPhone = data.riderPhone || data.rider_phone || '';
    const found = findOrderRow(orderId);
    if (!found) return createResponse(false, 'Order not found');
    const sheet = found.sheet;
    const rowIndex = found.index; // 1-based row index in sheet
    // Persist rider phone (col 16), id (col 12), name (col 13), and assigned_at (col 17)
    // Ensure at least 17 columns exist to store these without overwriting created_at (col 11)
    if (sheet.getLastColumn() < 17) {
      sheet.insertColumnsAfter(sheet.getLastColumn(), 17 - sheet.getLastColumn());
    }
    sheet.getRange(rowIndex, 16).setValue(riderPhone);
    sheet.getRange(rowIndex, 12).setValue(riderId);
    sheet.getRange(rowIndex, 13).setValue(riderName);
    sheet.getRange(rowIndex, 10).setValue('confirmed');
    sheet.getRange(rowIndex, 17).setValue(new Date());
    updateDeliveryTracking(orderId, 'rider_assigned', { riderId });
    return createResponse(true, 'Rider assigned successfully');
  } catch (error) {
    console.error('Error in assignRider:', error);
    return createResponse(false, 'Failed to assign rider: ' + error.message);
  }
}

/**
 * Complete booking across booking sheets
 */
function completeBookingCompat(data) {
  try {
    const orderId = data.order_id || data.orderId;
    if (!orderId) {
      console.warn('completeBookingCompat: missing orderId in payload', data);
      return createResponse(false, 'Missing order_id');
    }
    const found = findOrderRow(orderId);
    if (!found) {
      console.warn('completeBookingCompat: Order not found for orderId=', orderId);
      return createResponse(false, 'Order not found: ' + orderId);
    }
    const sheet = found.sheet;
    const rowIndex = found.index; // 1-based index
    console.log('completeBookingCompat: updating', { orderId, sheet: sheet.getName(), rowIndex });
    const deliveryTime = new Date();
    // Defensive: ensure sheet has required columns
    try {
      if (sheet.getLastColumn() < 15) {
        console.warn('completeBookingCompat: expanding columns for sheet', sheet.getName());
        sheet.insertColumnsAfter(sheet.getLastColumn(), 15 - sheet.getLastColumn());
      }
      sheet.getRange(rowIndex, 10).setValue('delivered'); // Status
      sheet.getRange(rowIndex, 15).setValue('delivered'); // DeliveryStatus
    } catch (colErr) {
      console.error('completeBookingCompat: column write failed', colErr);
      return createResponse(false, 'Failed writing status columns: ' + colErr.message);
    }
    // Ensure a delivery tracking row exists; if not, create and then update
    const existingProgress = getDeliveryProgressData(orderId);
    if (!existingProgress) {
      const sessionId = sheet.getRange(rowIndex, 2).getValue();
      initializeDeliveryTracking(orderId, sessionId);
    }
    updateDeliveryTracking(orderId, 'delivered', { deliveryTime });
    return createResponse(true, 'Order completed', { orderId, deliveryStatus: 'delivered' });
  } catch (error) {
    console.error('Error in completeBookingCompat:', error);
    return createResponse(false, 'Failed to complete booking: ' + error.message);
  }
}

/**
 * Frontend compatibility: handle 'submit_booking' with different field names
 */
function submitBookingCompat(data) {
  try {
    const type = (data.type || 'food').toLowerCase();
    const bookingSheetName = BOOKING_SHEETS[type] || BOOKING_SHEETS.food;
    // --- DO NOT block booking if there is a pending order in another service ---
    // Only check for duplicate pending order in the same sheet/type if you want to block duplicates per type:
    /*
    const sheet = getOrCreateSheet(bookingSheetName);
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][1] === data.sessionId && rows[i][9] === 'pending') {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          message: 'You already have a pending order awaiting rider assignment for this service.'
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    */
    const isLaundry = type === 'laundry';
    const isFood = type === 'food';
    const isParcel = type === 'parcel';
    const mapped = {
      sessionId: data.sessionId,
      name: data.customerName,
      phone: data.customerPhone,
      foodType: data.itemIdentity || data.itemType || (type.charAt(0).toUpperCase() + type.slice(1)),
      quantity: data.quantity,
      specialRequests: isLaundry
        ? JSON.stringify({
            pickupLocation: data.pickupLocation || '',
            basketName: data.basketName || '',
            notes: data.notes || ''
          })
        : (isFood
            ? JSON.stringify({
                pickupLocation: data.pickupLocation || '',
                notes: data.notes || ''
              })
            : (isParcel
                ? JSON.stringify({
                    pickupPerson: data.rider || '',
                    notes: data.notes || ''
                  })
                : (data.notes || ''))),
      deliveryLocation: data.deliveryLocation || data.pickupLocation || '',
      totalAmount: data.paymentCost || 0
    };

    const sheet = getOrCreateSheet(bookingSheetName);
    const timestamp = new Date();
    const orderId = generateOrderId();

    // Handle pre-selected rider for parcel
    const initialStatus = 'pending';
    const initialDeliveryStatus = 'waiting_for_rider';
    const riderId = '';
    const riderName = '';

    const bookingData = [
      orderId,
      mapped.sessionId,
      mapped.name,
      mapped.phone,
      mapped.foodType,
      mapped.quantity,
      mapped.specialRequests,
      mapped.deliveryLocation,
      mapped.totalAmount,
      initialStatus,
      timestamp,
      riderId, // riderId
      riderName, // riderName
      '', // estimatedDelivery
      initialDeliveryStatus // deliveryStatus
    ];

    sheet.appendRow(bookingData);
    initializeDeliveryTracking(orderId, mapped.sessionId);

    // Return shape expected by frontend
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Booking submitted successfully',
      order_id: orderId
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    console.error('Error in submitBookingCompat:', error);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Failed to submit booking: ' + error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * HTTP GET router for rider dashboard and tracking
 */
function doGet(e) {
  try {
    const action = e && e.parameter && e.parameter.action;
    if (!action) {
      return createResponse(false, 'Missing action');
    }
    switch (action) {
      case 'get_all_bookings': {
        const type = (e.parameter.type || 'all').toLowerCase();
        return getAllBookingsUnified(type);
      }
      case 'get_booking_status': {
        const orderId = e.parameter.order_id;
        return getBookingStatusByOrderId(orderId);
      }
      case 'get_delivery_status': {
        const orderId = e.parameter.order_id;
        return getDeliveryStatusByOrderId(orderId);
      }
      case 'get_messages': {
        const orderId = e.parameter.order_id;
        const since = e.parameter.since || '';
        return getMessages(orderId, since);
      }
      default:
        return createResponse(false, 'Invalid GET action');
    }
  } catch (error) {
    console.error('Error in doGet:', error);
    return createResponse(false, 'Server error: ' + (error && error.message ? error.message : error));
  }
}

/**
 * Frontend compatibility: list all bookings for rider dashboard
 */
function getAllBookingsCompat() {
  try {
    return getAllBookingsUnified('all');
  } catch (error) {
    console.error('Error in getAllBookingsCompat:', error);
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'Failed to load bookings: ' + error.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Unified bookings across food/parcel/laundry
 */
function getAllBookingsUnified(type) {
  const types = type === 'all' ? Object.keys(BOOKING_SHEETS) : [type];
  const bookings = [];
  types.forEach(t => {
    const sheetName = BOOKING_SHEETS[t];
    if (!sheetName) return;
    const sheet = getOrCreateSheet(sheetName);
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r[0]) continue;
      const statusMapped = mapStatusForFrontend(r[9], r[14]);
      // Only include non-cancelled bookings in dashboard
      if (statusMapped === 'cancelled') continue;
      // Build booking_details with type-specific mapping
      let bookingDetails = {
        itemIdentity: r[4] || '',
        quantity: r[5] || 1,
        notes: r[6] || '',
        pickupLocation: '',
        deliveryLocation: r[7] || ''
      };
      if (t === 'laundry') {
        // Try to parse specialRequests JSON to extract pickup and basket
        try {
          const sr = r[6];
          if (sr && typeof sr === 'string' && (sr.startsWith('{') || sr.startsWith('['))) {
            const obj = JSON.parse(sr);
            bookingDetails.pickupLocation = obj.pickupLocation || '';
            bookingDetails.basketName = obj.basketName || '';
            bookingDetails.notes = obj.notes || '';
          }
        } catch (e) {
          // leave defaults
        }
      } else if (t === 'food') {
        // Parse specialRequests JSON to extract pickup for food
        try {
          const sr = r[6];
          if (sr && typeof sr === 'string' && (sr.startsWith('{') || sr.startsWith('['))) {
            const obj = JSON.parse(sr);
            bookingDetails.pickupLocation = obj.pickupLocation || '';
            bookingDetails.notes = obj.notes || bookingDetails.notes;
          }
        } catch (e) {
          // ignore parsing errors, keep defaults
        }
      } else if (t === 'parcel') {
        // Parse specialRequests JSON to extract pickup person for parcel
        try {
          const sr = r[6];
          if (sr && typeof sr === 'string' && (sr.startsWith('{') || sr.startsWith('['))) {
            const obj = JSON.parse(sr);
            bookingDetails.pickupPerson = obj.pickupPerson || '';
            bookingDetails.notes = obj.notes || bookingDetails.notes;
          }
        } catch (e) {
          // ignore parsing errors
        }
      }
      bookings.push({
        order_id: r[0],
        created_at: r[10] ? new Date(r[10]).toISOString() : null,
        status: statusMapped === 'delivered' ? 'completed' : statusMapped,
        rider_id: r[11] || '',
        rider_name: r[12] || '',
        assigned_at: r[16] ? new Date(r[16]).toISOString() : null,
        completed_at: (r[9] === 'delivered' || r[14] === 'delivered') ? (r[10] ? new Date(r[10]).toISOString() : new Date().toISOString()) : null,
        booking_type: t,
        customer_name: r[2] || '',
        customer_phone: r[3] || '',
        payment_status: (r[8] && Number(r[8]) > 0) ? 'Not Yet Paid' : 'Paid',
        payment_amount: Number(r[8] || 0),
        booking_details: bookingDetails
      });
    }
  });
  return ContentService.createTextOutput(JSON.stringify({ success: true, bookings })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Frontend compatibility: GET booking status by order_id
 */
function getBookingStatusByOrderId(orderId) {
  try {
    const found = findOrderRow(orderId);
    if (found) {
      const row = found.row;
      const mappedStatus = mapStatusForFrontend(row[9], row[14]);
      const booking = {
        order_id: row[0],
        status: mappedStatus,
        rider_name: row[12] || '',
        rider_phone: row[15] || ''
      };
      return ContentService.createTextOutput(JSON.stringify({ success: true, booking })).setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Order not found'
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    console.error('Error in getBookingStatusByOrderId:', error);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Failed to get booking status: ' + error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Frontend compatibility: GET delivery status by order_id
 */
function getDeliveryStatusByOrderId(orderId) {
  try {
    const progressData = getDeliveryProgressData(orderId);
    if (!progressData) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: 'No delivery record yet'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Map delivery status to progress and eta
    const map = {
      waiting_for_rider: { progress: 10 },
      rider_assigned: { progress: 40 },
      on_the_way: { progress: 75 },
      delivered: { progress: 100 }
    };
    const base = map[progressData.status] || { progress: 20 };

    let etaMinutes = 0;
    if (progressData.estimatedArrival) {
      const etaMs = new Date(progressData.estimatedArrival).getTime() - Date.now();
      etaMinutes = Math.max(0, Math.round(etaMs / 60000));
    } else {
      etaMinutes = progressData.status === 'on_the_way' ? 20 : 30;
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      delivery: {
        progress: base.progress,
        eta: etaMinutes
      }
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    console.error('Error in getDeliveryStatusByOrderId:', error);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Failed to get delivery status: ' + error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Frontend compatibility: complete booking by order_id
 */
// (legacy completeBookingCompat removed in favor of unified version above)

/**
 * Map internal status to frontend status keywords
 */
function mapStatusForFrontend(status, deliveryStatus) {
  if (deliveryStatus === 'cancelled' || status === 'cancelled') return 'cancelled';
  if (deliveryStatus === 'delivered' || status === 'delivered') return 'delivered';
  if (deliveryStatus === 'on_the_way') return 'picked_up';
  if (deliveryStatus === 'rider_assigned' || status === 'confirmed') return 'assigned';
  return 'pending';
}

/**
 * Messaging: store rider->user messages
 * Columns: [Timestamp, OrderId, SenderType, SenderId, MessageText]
 */
function sendMessage(data) {
  try {
    const orderId = data.order_id || data.orderId;
    const senderType = (data.sender_type || data.senderType || 'rider').toLowerCase();
    const senderId = data.sender_id || data.senderId || '';
    const text = (data.text || '').toString().trim();
    if (!orderId || !text) {
      return createResponse(false, 'Missing order_id or text');
    }
    const sheet = getOrCreateSheet(MESSAGES_SHEET_NAME);
    sheet.appendRow([new Date(), orderId, senderType, senderId, text]);
    return createResponse(true, 'Message sent');
  } catch (err) {
    console.error('sendMessage error:', err);
    return createResponse(false, 'Failed to send message: ' + err.message);
  }
}

/**
 * Messaging: fetch messages for an order since an ISO timestamp (optional)
 */
function getMessages(orderId, sinceIso) {
  try {
    if (!orderId) return createResponse(false, 'Missing order_id');
    const sheet = getOrCreateSheet(MESSAGES_SHEET_NAME);
    const rows = sheet.getDataRange().getValues();
    let since = sinceIso ? new Date(sinceIso) : null;
    const messages = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (r[1] !== orderId) continue;
      const ts = r[0] ? new Date(r[0]) : null;
      if (since && ts && ts <= since) continue;
      messages.push({
        timestamp: ts ? ts.toISOString() : null,
        order_id: r[1],
        sender_type: r[2] || 'rider',
        sender_id: r[3] || '',
        text: r[4] || ''
      });
    }
    return ContentService.createTextOutput(JSON.stringify({ success: true, messages }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    console.error('getMessages error:', err);
    return createResponse(false, 'Failed to get messages: ' + err.message);
  }
}

/**
 * Handle GET requests for real-time updates
 */
// (legacy doGet removed; unified doGet is defined earlier)

/**
 * Submit a new food booking
 */
function submitBooking(data) {
  try {
    const type = (data.type || 'food').toLowerCase();
    const bookingSheetName = BOOKING_SHEETS[type] || BOOKING_SHEETS.food;
    const sheet = getOrCreateSheet(bookingSheetName);
    const timestamp = new Date();
    const orderId = generateOrderId();
    
    // Prepare booking data
    const bookingData = [
      orderId,
      data.sessionId,
      data.name,
      data.phone,
      data.foodType || data.itemType || (type.charAt(0).toUpperCase() + type.slice(1)),
      data.quantity,
      data.specialRequests || '',
      data.deliveryLocation,
      data.totalAmount,
      'pending', // status
      timestamp,
      '', // riderId
      '', // riderName
      '', // estimatedDelivery
      'waiting_for_rider' // deliveryStatus
    ];
    
    // Add to spreadsheet
    sheet.appendRow(bookingData);
    
    // Initialize delivery tracking
    initializeDeliveryTracking(orderId, data.sessionId);
    
    return createResponse(true, 'Booking submitted successfully', {
      orderId: orderId,
      status: 'pending',
      estimatedTime: '30-45 minutes',
      deliveryStatus: 'waiting_for_rider'
    });
    
  } catch (error) {
    console.error('Error submitting booking:', error);
    return createResponse(false, 'Failed to submit booking: ' + error.message);
  }
}

/**
 * Get current order status for real-time updates
 */
function getOrderStatus(sessionId) {
  try {
    // Search across all booking sheets for the latest by sessionId
    let latestOrder = null;
    Object.keys(BOOKING_SHEETS).forEach(t => {
      const sheet = getOrCreateSheet(BOOKING_SHEETS[t]);
      const rows = sheet.getDataRange().getValues();
      for (let i = rows.length - 1; i >= 1; i--) {
        if (rows[i][1] === sessionId) {
          latestOrder = {
            orderId: rows[i][0],
            sessionId: rows[i][1],
            name: rows[i][2],
            phone: rows[i][3],
            foodType: rows[i][4],
            quantity: rows[i][5],
            specialRequests: rows[i][6],
            deliveryLocation: rows[i][7],
            totalAmount: rows[i][8],
            status: rows[i][9],
            timestamp: rows[i][10],
            riderId: rows[i][11],
            riderName: rows[i][12],
            estimatedDelivery: rows[i][13],
            deliveryStatus: rows[i][14]
          };
          break;
        }
      }
    });
    
    if (!latestOrder) {
      return createResponse(false, 'No order found for this session');
    }
    
    // Get delivery progress if rider is assigned
    let deliveryProgress = null;
    if (latestOrder.riderId) {
      deliveryProgress = getDeliveryProgressData(latestOrder.orderId);
    }
    
    return createResponse(true, 'Order status retrieved', {
      order: latestOrder,
      deliveryProgress: deliveryProgress,
      lastUpdated: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error getting order status:', error);
    return createResponse(false, 'Failed to get order status: ' + error.message);
  }
}

/**
 * Cancel booking across booking sheets (removes from dashboard)
 */
function cancelBookingCompat(data) {
  try {
    const orderId = data.order_id || data.orderId;
    if (!orderId) {
      return createResponse(false, 'Missing order_id');
    }
    const found = findOrderRow(orderId);
    if (!found) {
      return createResponse(false, 'Order not found: ' + orderId);
    }
    const sheet = found.sheet;
    const rowIndex = found.index; // 1-based index

    // Mark as cancelled in status columns (do not delete row for audit/history)
    // Status col 10, DeliveryStatus col 15
    if (sheet.getLastColumn() < 15) {
      sheet.insertColumnsAfter(sheet.getLastColumn(), 15 - sheet.getLastColumn());
    }
    sheet.getRange(rowIndex, 10).setValue('cancelled');
    sheet.getRange(rowIndex, 15).setValue('cancelled');

    // Optionally, update Deliveries sheet if exists
    try {
      updateDeliveryTracking(orderId, 'cancelled', { cancelledTime: new Date() });
    } catch (e) {}

    return createResponse(true, 'Booking cancelled and removed from dashboard', { orderId, status: 'cancelled' });
  } catch (error) {
    console.error('Error in cancelBookingCompat:', error);
    return createResponse(false, 'Failed to cancel booking: ' + error.message);
  }
}

/**
 * Initialize delivery tracking for an order
 */
function initializeDeliveryTracking(orderId, sessionId) {
  try {
    const sheet = getOrCreateSheet(DELIVERY_SHEET_NAME);
    const timestamp = new Date();
    
    const trackingData = [
      orderId,
      sessionId,
      'waiting_for_rider',
      timestamp,
      '', // riderId
      '', // riderLocation
      '', // estimatedArrival
      '', // notes
      timestamp // lastUpdated
    ];
    
    sheet.appendRow(trackingData);
  } catch (error) {
    console.error('Error initializing delivery tracking:', error);
  }
}

/**
 * Update delivery tracking information
 */
function updateDeliveryTracking(orderId, status, additionalData = {}) {
  try {
    const sheet = getOrCreateSheet(DELIVERY_SHEET_NAME);
    const dataRange = sheet.getDataRange().getValues();
    
    for (let i = 1; i < dataRange.length; i++) {
      if (dataRange[i][0] === orderId) {
        const timestamp = new Date();
        
        sheet.getRange(i + 1, 3).setValue(status); // status
        sheet.getRange(i + 1, 9).setValue(timestamp); // lastUpdated
        
        if (additionalData.riderId) {
          sheet.getRange(i + 1, 5).setValue(additionalData.riderId);
        }
        if (additionalData.riderLocation) {
          sheet.getRange(i + 1, 6).setValue(JSON.stringify(additionalData.riderLocation));
        }
        if (additionalData.estimatedArrival) {
          sheet.getRange(i + 1, 7).setValue(additionalData.estimatedArrival);
        }
        if (additionalData.notes) {
          sheet.getRange(i + 1, 8).setValue(additionalData.notes);
        }
        
        break;
      }
    }
  } catch (error) {
    console.error('Error updating delivery tracking:', error);
  }
}

/**
 * Get delivery progress data
 */
function getDeliveryProgressData(orderId) {
  try {
    const sheet = getOrCreateSheet(DELIVERY_SHEET_NAME);
    const dataRange = sheet.getDataRange().getValues();
    
    for (let i = 1; i < dataRange.length; i++) {
      if (dataRange[i][0] === orderId) {
        return {
          orderId: dataRange[i][0],
          sessionId: dataRange[i][1],
          status: dataRange[i][2],
          timestamp: dataRange[i][3],
          riderId: dataRange[i][4],
          riderLocation: dataRange[i][5] ? JSON.parse(dataRange[i][5]) : null,
          estimatedArrival: dataRange[i][6],
          notes: dataRange[i][7],
          lastUpdated: dataRange[i][8]
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error getting delivery progress:', error);
    return null;
  }
}

/**
 * Get or create a spreadsheet sheet
 */
function getOrCreateSheet(sheetName) {
  let ssProp = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  // Allow either a raw ID or a full URL in SPREADSHEET_ID
  if (ssProp && ssProp.indexOf('/d/') !== -1) {
    const match = ssProp.match(/\/d\/([a-zA-Z0-9-_]+)\//);
    if (match && match[1]) ssProp = match[1];
  }

  let spreadsheet = null;
  if (ssProp) {
    try {
      spreadsheet = SpreadsheetApp.openById(ssProp);
    } catch (err) {
      console.warn('Invalid SPREADSHEET_ID, will create a new one:', err);
    }
  } else {
    spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  }
  if (!spreadsheet) {
    // Auto-create a spreadsheet if none is bound and no SPREADSHEET_ID set
    spreadsheet = SpreadsheetApp.create('AUP Grab Unified Database');
    PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', spreadsheet.getId());
  }
  let sheet = spreadsheet.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
    
    // Add headers based on sheet type
    if (Object.values(BOOKING_SHEETS).indexOf(sheetName) !== -1) {
      sheet.getRange(1, 1, 1, 15).setValues([[
        'OrderID', 'SessionID', 'Name', 'Phone', 'ItemType', 
        'Quantity', 'SpecialRequests', 'DeliveryLocation', 'TotalAmount', 
        'Status', 'Timestamp', 'RiderID', 'RiderName', 'EstimatedDelivery', 'DeliveryStatus'
      ]]);
    } else if (sheetName === DELIVERY_SHEET_NAME) {
      sheet.getRange(1, 1, 1, 9).setValues([[
        'OrderID', 'SessionID', 'Status', 'Timestamp', 'RiderID', 
        'RiderLocation', 'EstimatedArrival', 'Notes', 'LastUpdated'
      ]]);
    }
  }
  // Normalize existing sheet to expected structure
  try {
    if (Object.values(BOOKING_SHEETS).indexOf(sheetName) !== -1) {
      const expectedCols = 15;
      const lastCol = sheet.getLastColumn();
      if (lastCol < expectedCols) {
        sheet.insertColumnsAfter(lastCol, expectedCols - lastCol);
      }
      const headers = ['OrderID','SessionID','Name','Phone','ItemType','Quantity','SpecialRequests','DeliveryLocation','TotalAmount','Status','Timestamp','RiderID','RiderName','EstimatedDelivery','DeliveryStatus'];
      const headerRange = sheet.getRange(1, 1, 1, expectedCols);
      const current = headerRange.getValues()[0];
      // If headers are missing or incomplete, rewrite them
      let needRewrite = false;
      for (let i = 0; i < expectedCols; i++) {
        if (!current[i] || current[i] !== headers[i]) { needRewrite = true; break; }
      }
      if (needRewrite) {
        headerRange.setValues([headers]);
      }
    } else if (sheetName === DELIVERY_SHEET_NAME) {
      const expectedCols = 9;
      const lastCol = sheet.getLastColumn();
      if (lastCol < expectedCols) {
        sheet.insertColumnsAfter(lastCol, expectedCols - lastCol);
      }
      const headers = ['OrderID','SessionID','Status','Timestamp','RiderID','RiderLocation','EstimatedArrival','Notes','LastUpdated'];
      const headerRange = sheet.getRange(1, 1, 1, expectedCols);
      const current = headerRange.getValues()[0];
      let needRewrite = false;
      for (let i = 0; i < expectedCols; i++) {
        if (!current[i] || current[i] !== headers[i]) { needRewrite = true; break; }
      }
      if (needRewrite) {
        headerRange.setValues([headers]);
      }
    }
  } catch (normErr) {
    console.warn('Sheet normalization warning for', sheetName, normErr);
  }
  
  return sheet;
}

 

/**
 * Trigger function for real-time updates (can be called by time-driven triggers)
 */
function processRealTimeUpdates() {
  try {
    // This function can be set up with time-driven triggers
    // to automatically update order statuses, assign riders, etc.
    
    Object.keys(BOOKING_SHEETS).forEach(t => {
      const sheet = getOrCreateSheet(BOOKING_SHEETS[t]);
      const dataRange = sheet.getDataRange().getValues();
      for (let i = 1; i < dataRange.length; i++) {
        const order = dataRange[i];
        const status = order[9];
        const ts = order[10];
        const timestamp = ts ? new Date(ts) : null;
        const timeDiff = timestamp ? (Date.now() - timestamp.getTime()) : 0;
        
        // Auto-assign riders after 5 minutes for pending orders
        if (status === 'pending' && timeDiff > 5 * 60 * 1000 && !order[11]) {
          autoAssignRider(order[0]); // orderId
        }
        
        // Update estimated delivery times
        if (status === 'confirmed' && order[11]) { // has rider
          updateEstimatedDelivery(order[0]);
        }
      }
    });
    
  } catch (error) {
    console.error('Error in processRealTimeUpdates:', error);
  }
}

/**
 * Auto-assign available rider (simulation)
 */
function autoAssignRider(orderId) {
  const availableRiders = [
    { id: 'R001', name: 'John Doe' },
    { id: 'R002', name: 'Jane Smith' },
    { id: 'R003', name: 'Mike Johnson' }
  ];
  
  const randomRider = availableRiders[Math.floor(Math.random() * availableRiders.length)];
  
  assignRider({
    orderId: orderId,
    riderId: randomRider.id,
    riderName: randomRider.name
  });
}

/**
 * Update estimated delivery time based on current conditions
 */
function updateEstimatedDelivery(orderId) {
  // This could integrate with real mapping APIs for accurate delivery times
  const estimatedTime = new Date(Date.now() + (25 + Math.random() * 20) * 60000); // 25-45 minutes
  
  updateDeliveryStatus({
    orderId: orderId,
    deliveryStatus: 'on_the_way',
    estimatedArrival: estimatedTime
  });
}
