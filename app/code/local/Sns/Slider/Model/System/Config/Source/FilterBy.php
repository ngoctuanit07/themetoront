<?php

class Sns_Slider_Model_System_Config_Source_FilterBy
{
	public function toOptionArray()
	{
		return array(
			array('value' => 'all',	'label' => Mage::helper('slider')->__('All product')),
			array('value' => 'sale', 	'label' => Mage::helper('slider')->__('Only Sale product')),
			array('value' => 'deals', 	'label' => Mage::helper('slider')->__('Hot Deals'))
		);
	}
}
